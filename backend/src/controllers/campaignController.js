import pool from '../config/database.js';

/**
 * Create a new marketing campaign
 * @route POST /api/admin/campaigns
 */
export const createCampaign = async (req, res) => {
  try {
    const {
      campaignName,
      description,
      campaignType,
      targetUserType,
      pointMultiplier,
      conditions,
      startDate,
      endDate,
      isStackable,
      createdBy,
    } = req.body;

    if (!campaignName || !campaignType || !targetUserType || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO marketing_campaigns
       (campaign_name, description, campaign_type, target_user_type, point_multiplier,
        conditions, start_date, end_date, is_stackable, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        campaignName,
        description || null,
        campaignType,
        targetUserType,
        pointMultiplier || 1.0,
        conditions ? JSON.stringify(conditions) : null,
        startDate,
        endDate,
        isStackable || false,
        createdBy,
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    console.error('Error creating campaign:', err);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
};

/**
 * Get all campaigns
 * @route GET /api/admin/campaigns?active=true
 */
export const getAllCampaigns = async (req, res) => {
  try {
    const { active } = req.query;

    let query = 'SELECT * FROM marketing_campaigns';
    const params = [];

    if (active === 'true') {
      query += ' WHERE is_active = true AND NOW() BETWEEN start_date AND end_date';
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    const campaigns = await Promise.all(
      result.rows.map(async (campaign) => {
        // Get rules for this campaign
        const rulesResult = await pool.query(
          'SELECT action_type, base_points FROM campaign_rules WHERE campaign_id = $1',
          [campaign.id]
        );

        return {
          ...campaign,
          rules: rulesResult.rows,
        };
      })
    );

    res.json({
      success: true,
      data: campaigns,
    });
  } catch (err) {
    console.error('Error getting campaigns:', err);
    res.status(500).json({ error: 'Failed to get campaigns' });
  }
};

/**
 * Update campaign
 * @route PUT /api/admin/campaigns/:id
 */
export const updateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      campaignName,
      description,
      pointMultiplier,
      conditions,
      startDate,
      endDate,
      isActive,
      isStackable,
    } = req.body;

    const result = await pool.query(
      `UPDATE marketing_campaigns
       SET campaign_name = COALESCE($1, campaign_name),
           description = COALESCE($2, description),
           point_multiplier = COALESCE($3, point_multiplier),
           conditions = COALESCE($4, conditions),
           start_date = COALESCE($5, start_date),
           end_date = COALESCE($6, end_date),
           is_active = COALESCE($7, is_active),
           is_stackable = COALESCE($8, is_stackable),
           updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        campaignName,
        description,
        pointMultiplier,
        conditions ? JSON.stringify(conditions) : null,
        startDate,
        endDate,
        isActive,
        isStackable,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    console.error('Error updating campaign:', err);
    res.status(500).json({ error: 'Failed to update campaign' });
  }
};

/**
 * Delete campaign
 * @route DELETE /api/admin/campaigns/:id
 */
export const deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM marketing_campaigns WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json({
      success: true,
      message: 'Campaign deleted successfully',
    });
  } catch (err) {
    console.error('Error deleting campaign:', err);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
};

/**
 * Create campaign rule (point value for action)
 * @route POST /api/admin/campaigns/:campaignId/rules
 */
export const createCampaignRule = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { actionType, basePoints, description } = req.body;

    if (!actionType || basePoints === undefined) {
      return res.status(400).json({ error: 'Action type and base points required' });
    }

    const result = await pool.query(
      `INSERT INTO campaign_rules (campaign_id, action_type, base_points, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [campaignId, actionType, basePoints, description || null]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    console.error('Error creating campaign rule:', err);
    res.status(500).json({ error: 'Failed to create campaign rule' });
  }
};

/**
 * Update campaign rule
 * @route PUT /api/admin/campaigns/:campaignId/rules/:ruleId
 */
export const updateCampaignRule = async (req, res) => {
  try {
    const { campaignId, ruleId } = req.params;
    const { basePoints, description } = req.body;

    const result = await pool.query(
      `UPDATE campaign_rules
       SET base_points = COALESCE($1, base_points),
           description = COALESCE($2, description)
       WHERE id = $3 AND campaign_id = $4
       RETURNING *`,
      [basePoints, description, ruleId, campaignId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    console.error('Error updating campaign rule:', err);
    res.status(500).json({ error: 'Failed to update campaign rule' });
  }
};

/**
 * Assign campaign to users
 * @route POST /api/admin/campaigns/:campaignId/assign-users
 * @body { userIds: [] }
 */
export const assignCampaignToUsers = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'User IDs array required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let enrolledCount = 0;

      for (const userId of userIds) {
        const result = await client.query(
          `INSERT INTO user_campaigns (user_id, campaign_id)
           VALUES ($1, $2)
           ON CONFLICT (user_id, campaign_id) DO NOTHING
           RETURNING id`,
          [userId, campaignId]
        );

        if (result.rows.length > 0) {
          enrolledCount++;
        }
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        data: {
          campaignId,
          usersEnrolled: enrolledCount,
          totalUsers: userIds.length,
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error assigning campaign:', err);
    res.status(500).json({ error: 'Failed to assign campaign' });
  }
};

/**
 * Get campaign users
 * @route GET /api/admin/campaigns/:campaignId/users?limit=100&offset=0
 */
export const getCampaignUsers = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT
        u.id, u.full_name, u.email, u.role,
        uc.enrolled_at, uc.is_active
       FROM user_campaigns uc
       JOIN users u ON uc.user_id = u.id
       WHERE uc.campaign_id = $1
       ORDER BY uc.enrolled_at DESC
       LIMIT $2 OFFSET $3`,
      [campaignId, parseInt(limit), parseInt(offset)]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM user_campaigns WHERE campaign_id = $1',
      [campaignId]
    );

    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].total),
    });
  } catch (err) {
    console.error('Error getting campaign users:', err);
    res.status(500).json({ error: 'Failed to get campaign users' });
  }
};

/**
 * Create reward
 * @route POST /api/admin/rewards
 */
export const createReward = async (req, res) => {
  try {
    const {
      campaignId,
      rewardName,
      description,
      pointCost,
      rewardType,
      rewardValue,
      availability,
      quantityAvailable,
    } = req.body;

    if (!rewardName || !pointCost || !rewardType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO rewards_catalog
       (campaign_id, reward_name, description, point_cost, reward_type,
        reward_value, availability, quantity_available)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        campaignId || null,
        rewardName,
        description || null,
        pointCost,
        rewardType,
        rewardValue || null,
        availability || 'UNLIMITED',
        quantityAvailable || null,
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    console.error('Error creating reward:', err);
    res.status(500).json({ error: 'Failed to create reward' });
  }
};

/**
 * Get all rewards
 * @route GET /api/admin/rewards
 */
export const getAllRewards = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM rewards_catalog ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error('Error getting rewards:', err);
    res.status(500).json({ error: 'Failed to get rewards' });
  }
};

/**
 * Update reward
 * @route PUT /api/admin/rewards/:id
 */
export const updateReward = async (req, res) => {
  try {
    const { id } = req.params;
    const { rewardName, description, pointCost, rewardValue, isActive } = req.body;

    const result = await pool.query(
      `UPDATE rewards_catalog
       SET reward_name = COALESCE($1, reward_name),
           description = COALESCE($2, description),
           point_cost = COALESCE($3, point_cost),
           reward_value = COALESCE($4, reward_value),
           is_active = COALESCE($5, is_active),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [rewardName, description, pointCost, rewardValue, isActive, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reward not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    console.error('Error updating reward:', err);
    res.status(500).json({ error: 'Failed to update reward' });
  }
};

/**
 * Delete reward
 * @route DELETE /api/admin/rewards/:id
 */
export const deleteReward = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM rewards_catalog WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reward not found' });
    }

    res.json({
      success: true,
      message: 'Reward deleted successfully',
    });
  } catch (err) {
    console.error('Error deleting reward:', err);
    res.status(500).json({ error: 'Failed to delete reward' });
  }
};
