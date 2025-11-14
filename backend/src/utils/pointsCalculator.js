import pool from '../config/database.js';

/**
 * Get all active campaigns for a user
 */
export const getUserActiveCampaigns = async (userId) => {
  try {
    const result = await pool.query(
      `SELECT
        uc.campaign_id, mc.campaign_name, mc.campaign_type,
        mc.point_multiplier, mc.is_stackable, mc.conditions
       FROM user_campaigns uc
       JOIN marketing_campaigns mc ON uc.campaign_id = mc.id
       WHERE uc.user_id = $1
       AND uc.is_active = true
       AND mc.is_active = true
       AND NOW() BETWEEN mc.start_date AND mc.end_date`,
      [userId]
    );
    return result.rows;
  } catch (err) {
    console.error('Error getting user active campaigns:', err);
    throw err;
  }
};

/**
 * Get campaign rule for a specific action
 */
export const getCampaignRule = async (campaignId, actionType) => {
  try {
    const result = await pool.query(
      'SELECT base_points FROM campaign_rules WHERE campaign_id = $1 AND action_type = $2',
      [campaignId, actionType]
    );
    return result.rows[0];
  } catch (err) {
    console.error('Error getting campaign rule:', err);
    throw err;
  }
};

/**
 * Calculate points for a user action considering all active campaigns
 * Returns: { totalPoints, breakdown: [{campaignId, campaignName, basePoints, multiplier, finalPoints}] }
 */
export const calculatePointsForAction = async (userId, actionType, basePoints = 0) => {
  try {
    const campaigns = await getUserActiveCampaigns(userId);
    let totalPoints = 0;
    const breakdown = [];

    // If no campaigns, return 0
    if (campaigns.length === 0) {
      return { totalPoints: 0, breakdown: [], baseCampaignPoints: basePoints };
    }

    // Calculate points from each campaign
    for (const campaign of campaigns) {
      const rule = await getCampaignRule(campaign.campaign_id, actionType);

      if (rule) {
        let campaignPoints = rule.base_points;

        // Apply campaign multiplier
        const finalPoints = Math.floor(campaignPoints * campaign.point_multiplier);

        breakdown.push({
          campaignId: campaign.campaign_id,
          campaignName: campaign.campaign_name,
          campaignType: campaign.campaign_type,
          basePoints: campaignPoints,
          multiplier: campaign.point_multiplier,
          finalPoints,
        });

        // If campaign is stackable, add to total; otherwise take the highest
        if (campaign.is_stackable) {
          totalPoints += finalPoints;
        }
      }
    }

    // If no stackable campaigns, use the highest value
    if (totalPoints === 0 && breakdown.length > 0) {
      const highestBreakdown = breakdown.reduce((prev, current) =>
        current.finalPoints > prev.finalPoints ? current : prev
      );
      totalPoints = highestBreakdown.finalPoints;
    }

    return { totalPoints, breakdown };
  } catch (err) {
    console.error('Error calculating points:', err);
    throw err;
  }
};

/**
 * Award points to user and record transaction
 */
export const awardPoints = async (userId, actionType, points, campaignId = null, deliveryId = null, multiplier = 1.0) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert transaction record
    const transactionResult = await client.query(
      `INSERT INTO points_transactions
       (user_id, campaign_id, delivery_id, action_type, points_earned,
        reason, description, multiplier_applied)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        userId,
        campaignId,
        deliveryId,
        actionType,
        points,
        actionType,
        `${actionType} completed with multiplier ${multiplier}`,
        multiplier,
      ]
    );

    // Update or create user points record
    await client.query(
      `INSERT INTO user_points (user_id, current_points, lifetime_points, last_activity_at, updated_at)
       VALUES ($1, $2, $2, NOW(), NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         current_points = user_points.current_points + $2,
         lifetime_points = user_points.lifetime_points + $2,
         last_activity_at = NOW(),
         updated_at = NOW()`,
      [userId, points]
    );

    await client.query('COMMIT');
    return transactionResult.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error awarding points:', err);
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Spend points and record transaction
 */
export const spendPoints = async (userId, pointsToSpend, reason = 'Reward redemption') => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check user has enough points
    const userPoints = await client.query(
      'SELECT current_points FROM user_points WHERE user_id = $1',
      [userId]
    );

    if (userPoints.rows.length === 0 || userPoints.rows[0].current_points < pointsToSpend) {
      throw new Error('Insufficient points balance');
    }

    // Record transaction
    const transactionResult = await client.query(
      `INSERT INTO points_transactions
       (user_id, action_type, points_spent, reason, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, 'REDEMPTION', pointsToSpend, reason, reason]
    );

    // Update points balance
    await client.query(
      `UPDATE user_points
       SET current_points = current_points - $1, updated_at = NOW()
       WHERE user_id = $2`,
      [pointsToSpend, userId]
    );

    await client.query('COMMIT');
    return transactionResult.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error spending points:', err);
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Calculate user tier based on current points
 */
export const calculateUserTier = (currentPoints) => {
  if (currentPoints >= 15000) return 'PLATINUM';
  if (currentPoints >= 5000) return 'GOLD';
  if (currentPoints >= 1000) return 'SILVER';
  return 'BRONZE';
};

/**
 * Update user tier if points changed
 */
export const updateUserTier = async (userId) => {
  try {
    const result = await pool.query(
      'SELECT current_points FROM user_points WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) return;

    const newTier = calculateUserTier(result.rows[0].current_points);

    // Tier validity: 1 year from now
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    await pool.query(
      'UPDATE user_points SET tier_level = $1, tier_expires_at = $2, updated_at = NOW() WHERE user_id = $3',
      [newTier, expiresAt, userId]
    );

    return newTier;
  } catch (err) {
    console.error('Error updating user tier:', err);
    throw err;
  }
};

/**
 * Get user points summary
 */
export const getUserPointsSummary = async (userId) => {
  try {
    const result = await pool.query(
      `SELECT
        user_id, current_points, lifetime_points, tier_level,
        tier_expires_at, last_activity_at, updated_at
       FROM user_points
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return {
        userId,
        currentPoints: 0,
        lifetimePoints: 0,
        tierLevel: 'BRONZE',
        tierExpiresAt: null,
        lastActivityAt: null,
      };
    }

    const row = result.rows[0];
    return {
      userId: row.user_id,
      currentPoints: row.current_points,
      lifetimePoints: row.lifetime_points,
      tierLevel: row.tier_level,
      tierExpiresAt: row.tier_expires_at,
      lastActivityAt: row.last_activity_at,
    };
  } catch (err) {
    console.error('Error getting user points summary:', err);
    throw err;
  }
};

/**
 * Get points transaction history for user
 */
export const getUserPointsHistory = async (userId, limit = 50, offset = 0) => {
  try {
    const result = await pool.query(
      `SELECT
        pt.id, pt.action_type, pt.points_earned, pt.points_spent,
        pt.reason, pt.multiplier_applied, pt.created_at,
        mc.campaign_name,
        d.id as delivery_id, d.status as delivery_status
       FROM points_transactions pt
       LEFT JOIN marketing_campaigns mc ON pt.campaign_id = mc.id
       LEFT JOIN deliveries d ON pt.delivery_id = d.id
       WHERE pt.user_id = $1
       ORDER BY pt.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows;
  } catch (err) {
    console.error('Error getting user points history:', err);
    throw err;
  }
};

/**
 * Initialize user points record (called on user registration)
 */
export const initializeUserPoints = async (userId) => {
  try {
    await pool.query(
      `INSERT INTO user_points (user_id, current_points, lifetime_points)
       VALUES ($1, 0, 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
  } catch (err) {
    console.error('Error initializing user points:', err);
    throw err;
  }
};

/**
 * Auto-enroll user in campaigns based on their profile
 */
export const autoEnrollUserInCampaigns = async (userId, userRole, isNewUser = false) => {
  try {
    // Get eligible campaigns
    let targetTypes = ['ALL'];

    if (userRole === 'driver') {
      targetTypes.push('DRIVERS');
    } else if (userRole === 'customer') {
      targetTypes.push('CUSTOMERS');
    }

    if (isNewUser) {
      targetTypes.push('NEW_USERS');
    }

    const campaignsResult = await pool.query(
      `SELECT id FROM marketing_campaigns
       WHERE is_active = true
       AND target_user_type = ANY($1)
       AND NOW() BETWEEN start_date AND end_date`,
      [targetTypes]
    );

    // Enroll user in each eligible campaign
    for (const campaign of campaignsResult.rows) {
      await pool.query(
        `INSERT INTO user_campaigns (user_id, campaign_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, campaign_id) DO NOTHING`,
        [userId, campaign.id]
      );
    }
  } catch (err) {
    console.error('Error auto-enrolling user in campaigns:', err);
    throw err;
  }
};
