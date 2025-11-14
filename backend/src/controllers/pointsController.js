import pool from '../config/database.js';
import {
  getUserPointsSummary,
  getUserPointsHistory,
  getUserActiveCampaigns,
  spendPoints,
} from '../utils/pointsCalculator.js';

/**
 * Get user points and tier
 * @route GET /api/points/user/:userId
 */
export const getUserPoints = async (req, res) => {
  try {
    const { userId } = req.params;

    const summary = await getUserPointsSummary(userId);
    const activeCampaigns = await getUserActiveCampaigns(userId);

    res.json({
      success: true,
      data: {
        ...summary,
        activeCampaigns: activeCampaigns.map((c) => ({
          campaignId: c.campaign_id,
          campaignName: c.campaign_name,
          campaignType: c.campaign_type,
          multiplier: c.point_multiplier,
        })),
      },
    });
  } catch (err) {
    console.error('Error getting user points:', err);
    res.status(500).json({ error: 'Failed to get points' });
  }
};

/**
 * Get points transaction history
 * @route GET /api/points/history/:userId?limit=50&offset=0
 */
export const getUserPointsHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const result = await getUserPointsHistory(userId, parseInt(limit), parseInt(offset));

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('Error getting points history:', err);
    res.status(500).json({ error: 'Failed to get points history' });
  }
};

/**
 * Get available rewards for user
 * @route GET /api/rewards/available/:userId
 */
export const getAvailableRewards = async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user's current points
    const userResult = await pool.query(
      'SELECT current_points FROM user_points WHERE user_id = $1',
      [userId]
    );

    const currentPoints = userResult.rows[0]?.current_points || 0;

    // Get available rewards
    const rewardsResult = await pool.query(
      `SELECT
        id, reward_name, description, point_cost, reward_type,
        reward_value, availability, quantity_available, quantity_redeemed
       FROM rewards_catalog
       WHERE is_active = true
       AND (availability = 'UNLIMITED' OR quantity_redeemed < quantity_available)
       ORDER BY point_cost ASC`
    );

    // Map rewards and check if user can afford each one
    const rewards = rewardsResult.rows.map((reward) => ({
      id: reward.id,
      name: reward.reward_name,
      description: reward.description,
      pointCost: reward.point_cost,
      type: reward.reward_type,
      value: reward.reward_value,
      canAfford: currentPoints >= reward.point_cost,
      availability: reward.availability,
      quantityAvailable: reward.quantity_available,
      quantityRedeemed: reward.quantity_redeemed,
    }));

    res.json({
      success: true,
      data: {
        currentPoints,
        rewards,
      },
    });
  } catch (err) {
    console.error('Error getting available rewards:', err);
    res.status(500).json({ error: 'Failed to get rewards' });
  }
};

/**
 * Redeem points for reward
 * @route POST /api/rewards/redeem
 * @body { userId, rewardId }
 */
export const redeemReward = async (req, res) => {
  try {
    const { userId, rewardId } = req.body;

    if (!userId || !rewardId) {
      return res.status(400).json({ error: 'User ID and Reward ID required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get reward details
      const rewardResult = await client.query(
        `SELECT id, point_cost, reward_name, reward_type, reward_value,
                availability, quantity_available, quantity_redeemed
         FROM rewards_catalog WHERE id = $1 AND is_active = true`,
        [rewardId]
      );

      if (rewardResult.rows.length === 0) {
        throw new Error('Reward not found');
      }

      const reward = rewardResult.rows[0];

      // Check availability
      if (reward.availability === 'LIMITED' && reward.quantity_redeemed >= reward.quantity_available) {
        throw new Error('Reward is no longer available');
      }

      // Get user points
      const userPointsResult = await client.query(
        'SELECT current_points FROM user_points WHERE user_id = $1',
        [userId]
      );

      if (userPointsResult.rows.length === 0 || userPointsResult.rows[0].current_points < reward.point_cost) {
        throw new Error('Insufficient points');
      }

      // Generate reference code
      const referenceCode = `REW-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Record redemption
      const redemptionResult = await client.query(
        `INSERT INTO user_rewards_redeemed
         (user_id, reward_id, points_spent, reference_code, status)
         VALUES ($1, $2, $3, $4, 'REDEEMED')
         RETURNING *`,
        [userId, rewardId, reward.point_cost, referenceCode]
      );

      // Update reward quantity if limited
      if (reward.availability === 'LIMITED') {
        await client.query(
          'UPDATE rewards_catalog SET quantity_redeemed = quantity_redeemed + 1 WHERE id = $1',
          [rewardId]
        );
      }

      // Deduct points
      await client.query(
        `INSERT INTO points_transactions
         (user_id, action_type, points_spent, reason)
         VALUES ($1, 'REWARD_REDEMPTION', $2, $3)`,
        [userId, reward.point_cost, `Redeemed: ${reward.reward_name}`]
      );

      await client.query(
        'UPDATE user_points SET current_points = current_points - $1, updated_at = NOW() WHERE user_id = $2',
        [reward.point_cost, userId]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        data: {
          rewardId,
          rewardName: reward.reward_name,
          pointsSpent: reward.point_cost,
          referenceCode,
          rewardValue: reward.reward_value,
          rewardType: reward.reward_type,
          message: `Successfully redeemed ${reward.reward_name}. Reference: ${referenceCode}`,
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error redeeming reward:', err);
    res.status(400).json({ error: err.message || 'Failed to redeem reward' });
  }
};

/**
 * Get user's redeemed rewards
 * @route GET /api/rewards/history/:userId
 */
export const getRedeemedRewards = async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      `SELECT
        urr.id, urr.reference_code, urr.status, urr.redeemed_at, urr.used_at,
        rc.reward_name, rc.reward_type, rc.reward_value, urr.points_spent
       FROM user_rewards_redeemed urr
       JOIN rewards_catalog rc ON urr.reward_id = rc.id
       WHERE urr.user_id = $1
       ORDER BY urr.redeemed_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('Error getting redeemed rewards:', err);
    res.status(500).json({ error: 'Failed to get redeemed rewards' });
  }
};

/**
 * Get leaderboards
 * @route GET /api/points/leaderboards?type=customers&timeframe=all
 */
export const getLeaderboards = async (req, res) => {
  try {
    const { type = 'customers', timeframe = 'all' } = req.query;

    let query = '';
    const params = [10]; // Top 10 by default

    if (type === 'drivers') {
      query = `
        SELECT
          u.id, u.full_name, u.profile_image_url,
          up.current_points, up.lifetime_points, up.tier_level,
          (SELECT COUNT(*) FROM deliveries WHERE driver_id = u.id) as delivery_count,
          u.average_rating
        FROM user_points up
        JOIN users u ON up.user_id = u.id
        WHERE u.role = 'driver'
        ORDER BY up.current_points DESC
        LIMIT $1
      `;
    } else {
      query = `
        SELECT
          u.id, u.full_name, u.profile_image_url,
          up.current_points, up.lifetime_points, up.tier_level,
          (SELECT COUNT(*) FROM deliveries WHERE customer_id = u.id) as delivery_count
        FROM user_points up
        JOIN users u ON up.user_id = u.id
        WHERE u.role = 'customer'
        ORDER BY up.current_points DESC
        LIMIT $1
      `;
    }

    const result = await pool.query(query, params);

    const leaderboard = result.rows.map((row, index) => ({
      rank: index + 1,
      userId: row.id,
      name: row.full_name,
      profileImage: row.profile_image_url,
      currentPoints: row.current_points,
      lifetimePoints: row.lifetime_points,
      tier: row.tier_level,
      deliveryCount: row.delivery_count,
      rating: row.average_rating || null,
    }));

    res.json({
      success: true,
      data: leaderboard,
    });
  } catch (err) {
    console.error('Error getting leaderboards:', err);
    res.status(500).json({ error: 'Failed to get leaderboards' });
  }
};
