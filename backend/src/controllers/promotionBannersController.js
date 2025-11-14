import { query } from '../config/database.js';

/**
 * Create a promotion banner
 */
export const createPromotionBanner = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const {
      campaign_id,
      title,
      description,
      image_url,
      background_color,
      text_color,
      banner_type,
      target_user_type,
      call_to_action_text,
      call_to_action_link,
      priority,
      start_date,
      end_date,
    } = req.body;

    if (!title || !banner_type || !target_user_type || !start_date || !end_date) {
      return res.status(400).json({
        error: 'Required fields: title, banner_type, target_user_type, start_date, end_date',
      });
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    if (endDate <= startDate) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    const result = await query(
      `INSERT INTO promotion_banners (
        campaign_id, title, description, image_url, background_color, text_color,
        banner_type, target_user_type, call_to_action_text, call_to_action_link,
        is_active, priority, start_date, end_date, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11, $12, $13, $14)
      RETURNING *`,
      [
        campaign_id || null,
        title,
        description || null,
        image_url || null,
        background_color || '#667eea',
        text_color || '#ffffff',
        banner_type,
        target_user_type,
        call_to_action_text || null,
        call_to_action_link || null,
        priority || 0,
        startDate,
        endDate,
        req.user.id,
      ]
    );

    res.status(201).json({
      message: 'Promotion banner created successfully',
      banner: result.rows[0],
    });
  } catch (err) {
    console.error('Error creating promotion banner:', err);
    res.status(500).json({ error: 'Failed to create promotion banner' });
  }
};

/**
 * Get active promotion banners for user
 */
export const getActiveBanners = async (req, res) => {
  try {
    const userType = req.user ? req.user.role.toUpperCase() : 'CUSTOMER';

    const result = await query(
      `SELECT * FROM promotion_banners
       WHERE is_active = true
         AND (target_user_type = 'ALL' OR target_user_type = $1)
         AND start_date <= CURRENT_TIMESTAMP
         AND end_date > CURRENT_TIMESTAMP
       ORDER BY priority DESC, created_at DESC`,
      [userType]
    );

    res.json({ banners: result.rows });
  } catch (err) {
    console.error('Error fetching promotion banners:', err);
    res.status(500).json({ error: 'Failed to fetch promotion banners' });
  }
};

/**
 * Get all promotion banners (admin)
 */
export const getAllBanners = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { status = 'all', limit = 50, offset = 0 } = req.query;

    let whereClause = '';
    const params = [];

    if (status === 'active') {
      whereClause = 'WHERE is_active = true';
    } else if (status === 'inactive') {
      whereClause = 'WHERE is_active = false';
    } else if (status === 'upcoming') {
      whereClause = 'WHERE start_date > CURRENT_TIMESTAMP';
    } else if (status === 'expired') {
      whereClause = 'WHERE end_date <= CURRENT_TIMESTAMP';
    }

    const result = await query(
      `SELECT
        pb.*,
        u.full_name as created_by_name
       FROM promotion_banners pb
       LEFT JOIN users u ON pb.created_by = u.id
       ${whereClause}
       ORDER BY pb.priority DESC, pb.created_at DESC
       LIMIT $${whereClause ? 2 : 1} OFFSET $${whereClause ? 3 : 2}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM promotion_banners ${whereClause}`,
      params
    );

    res.json({
      banners: result.rows,
      total: parseInt(countResult.rows[0].total),
      hasMore: offset + limit < parseInt(countResult.rows[0].total),
    });
  } catch (err) {
    console.error('Error fetching promotion banners:', err);
    res.status(500).json({ error: 'Failed to fetch promotion banners' });
  }
};

/**
 * Get a specific banner
 */
export const getBannerById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT * FROM promotion_banners WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    res.json({ banner: result.rows[0] });
  } catch (err) {
    console.error('Error fetching banner:', err);
    res.status(500).json({ error: 'Failed to fetch banner' });
  }
};

/**
 * Update a promotion banner
 */
export const updateBanner = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;
    const {
      title,
      description,
      image_url,
      background_color,
      text_color,
      banner_type,
      target_user_type,
      call_to_action_text,
      call_to_action_link,
      priority,
      start_date,
      end_date,
      is_active,
    } = req.body;

    const updates = [];
    const params = [id];
    let paramIndex = 2;

    if (title) {
      updates.push(`title = $${paramIndex}`);
      params.push(title);
      paramIndex++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(description);
      paramIndex++;
    }

    if (image_url !== undefined) {
      updates.push(`image_url = $${paramIndex}`);
      params.push(image_url);
      paramIndex++;
    }

    if (background_color) {
      updates.push(`background_color = $${paramIndex}`);
      params.push(background_color);
      paramIndex++;
    }

    if (text_color) {
      updates.push(`text_color = $${paramIndex}`);
      params.push(text_color);
      paramIndex++;
    }

    if (banner_type) {
      updates.push(`banner_type = $${paramIndex}`);
      params.push(banner_type);
      paramIndex++;
    }

    if (target_user_type) {
      updates.push(`target_user_type = $${paramIndex}`);
      params.push(target_user_type);
      paramIndex++;
    }

    if (call_to_action_text !== undefined) {
      updates.push(`call_to_action_text = $${paramIndex}`);
      params.push(call_to_action_text);
      paramIndex++;
    }

    if (call_to_action_link !== undefined) {
      updates.push(`call_to_action_link = $${paramIndex}`);
      params.push(call_to_action_link);
      paramIndex++;
    }

    if (priority !== undefined) {
      updates.push(`priority = $${paramIndex}`);
      params.push(priority);
      paramIndex++;
    }

    if (start_date) {
      updates.push(`start_date = $${paramIndex}`);
      params.push(new Date(start_date));
      paramIndex++;
    }

    if (end_date) {
      updates.push(`end_date = $${paramIndex}`);
      params.push(new Date(end_date));
      paramIndex++;
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      params.push(is_active);
      paramIndex++;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    if (updates.length === 1) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const result = await query(
      `UPDATE promotion_banners
       SET ${updates.join(', ')}
       WHERE id = $1
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    res.json({
      message: 'Banner updated successfully',
      banner: result.rows[0],
    });
  } catch (err) {
    console.error('Error updating banner:', err);
    res.status(500).json({ error: 'Failed to update banner' });
  }
};

/**
 * Dismiss a banner for a user
 */
export const dismissBanner = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const bannerResult = await query(
      `SELECT dismissed_by_users FROM promotion_banners WHERE id = $1`,
      [id]
    );

    if (bannerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    let dismissedUsers = bannerResult.rows[0].dismissed_by_users || [];

    // Check if already dismissed
    if (!dismissedUsers.includes(userId)) {
      dismissedUsers.push(userId);

      await query(
        `UPDATE promotion_banners
         SET dismissed_by_users = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id, JSON.stringify(dismissedUsers)]
      );
    }

    res.json({
      message: 'Banner dismissed',
    });
  } catch (err) {
    console.error('Error dismissing banner:', err);
    res.status(500).json({ error: 'Failed to dismiss banner' });
  }
};

/**
 * Delete a promotion banner
 */
export const deleteBanner = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    const result = await query(
      `DELETE FROM promotion_banners WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    res.json({ message: 'Banner deleted successfully' });
  } catch (err) {
    console.error('Error deleting banner:', err);
    res.status(500).json({ error: 'Failed to delete banner' });
  }
};

/**
 * Get banner analytics
 */
export const getBannerAnalytics = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    const bannerResult = await query(
      `SELECT
        id, title, banner_type, target_user_type,
        dismissed_by_users,
        created_at, start_date, end_date
       FROM promotion_banners
       WHERE id = $1`,
      [id]
    );

    if (bannerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    const banner = bannerResult.rows[0];
    const dismissedCount = banner.dismissed_by_users ? banner.dismissed_by_users.length : 0;

    // Get total eligible users
    let totalEligible = 0;
    if (banner.target_user_type === 'ALL') {
      const countResult = await query('SELECT COUNT(*) as count FROM users');
      totalEligible = parseInt(countResult.rows[0].count);
    } else {
      const role = banner.target_user_type === 'CUSTOMER' ? 'customer' : 'driver';
      const countResult = await query(
        'SELECT COUNT(*) as count FROM users WHERE role = $1',
        [role]
      );
      totalEligible = parseInt(countResult.rows[0].count);
    }

    res.json({
      analytics: {
        banner_id: banner.id,
        title: banner.title,
        total_eligible_users: totalEligible,
        dismissed_count: dismissedCount,
        dismiss_rate: totalEligible > 0 ? ((dismissedCount / totalEligible) * 100).toFixed(2) : 0,
        duration_days: Math.ceil((new Date(banner.end_date) - new Date(banner.start_date)) / (1000 * 60 * 60 * 24)),
      },
    });
  } catch (err) {
    console.error('Error fetching banner analytics:', err);
    res.status(500).json({ error: 'Failed to fetch banner analytics' });
  }
};
