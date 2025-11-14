import { pool } from '../config/database.js';

/**
 * Get admin dashboard statistics
 */
export const getDashboardStats = async (req, res) => {
  try {
    // Get total counts
    const [usersResult, deliveriesResult, driversResult, reviewsResult] = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM users'),
      pool.query('SELECT COUNT(*) as total FROM deliveries'),
      pool.query('SELECT COUNT(*) as total FROM users WHERE role = $1', ['driver']),
      pool.query('SELECT COUNT(*) as total FROM delivery_reviews'),
    ]);

    // Get delivery status breakdown
    const statusResult = await pool.query(
      `SELECT status, COUNT(*) as count FROM deliveries GROUP BY status`
    );

    // Get today's deliveries
    const todayResult = await pool.query(
      `SELECT COUNT(*) as total FROM deliveries
       WHERE DATE(created_at) = CURRENT_DATE`
    );

    // Get revenue estimate (5% of completed deliveries)
    const revenueResult = await pool.query(
      `SELECT COUNT(*) as completed FROM deliveries WHERE status = 'DELIVERED'`
    );

    // Get average rating
    const ratingResult = await pool.query(
      `SELECT AVG(average_rating) as avg_rating FROM users WHERE role = 'driver'`
    );

    const statusBreakdown = {};
    statusResult.rows.forEach((row) => {
      statusBreakdown[row.status] = parseInt(row.count);
    });

    res.json({
      success: true,
      data: {
        total_users: parseInt(usersResult.rows[0].total),
        total_deliveries: parseInt(deliveriesResult.rows[0].total),
        total_drivers: parseInt(driversResult.rows[0].total),
        total_reviews: parseInt(reviewsResult.rows[0].total),
        today_deliveries: parseInt(todayResult.rows[0].total),
        completed_deliveries: parseInt(revenueResult.rows[0].completed),
        average_rating: parseFloat(ratingResult.rows[0].avg_rating || 0).toFixed(2),
        status_breakdown: statusBreakdown,
      },
    });
  } catch (err) {
    console.error('Get dashboard stats error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
};

/**
 * Get all users with pagination and filtering
 */
export const getAllUsers = async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = parseInt(req.query.offset) || 0;
  const role = req.query.role;
  const search = req.query.search;

  try {
    let query = 'SELECT * FROM users WHERE 1=1';
    const params = [];

    if (role) {
      query += ` AND role = $${params.length + 1}`;
      params.push(role);
    }

    if (search) {
      query += ` AND (full_name ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
      params.push(`%${search}%`);
    }

    // Get total count
    const countResult = await pool.query(
      query.replace('SELECT *', 'SELECT COUNT(*) as total'),
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get users with pagination
    const usersResult = await pool.query(
      query +
        ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: usersResult.rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

/**
 * Get all deliveries with filtering and pagination
 */
export const getAllDeliveries = async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = parseInt(req.query.offset) || 0;
  const status = req.query.status;
  const priority = req.query.priority;

  try {
    let query = `SELECT d.*, u.full_name as customer_name, dr.full_name as driver_name
                 FROM deliveries d
                 JOIN users u ON d.customer_id = u.id
                 LEFT JOIN users dr ON d.driver_id = dr.id
                 WHERE 1=1`;
    const params = [];

    if (status) {
      query += ` AND d.status = $${params.length + 1}`;
      params.push(status);
    }

    if (priority) {
      query += ` AND d.priority = $${params.length + 1}`;
      params.push(priority);
    }

    // Get total count
    const countResult = await pool.query(
      query.replace(
        'SELECT d.*, u.full_name as customer_name, dr.full_name as driver_name',
        'SELECT COUNT(*) as total'
      ),
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get deliveries with pagination
    const deliveriesResult = await pool.query(
      query +
        ` ORDER BY d.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: deliveriesResult.rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (err) {
    console.error('Get deliveries error:', err);
    res.status(500).json({ error: 'Failed to fetch deliveries' });
  }
};

/**
 * Get driver performance analytics
 */
export const getDriverAnalytics = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         u.id, u.full_name, u.email, u.average_rating,
         COUNT(d.id) as total_deliveries,
         SUM(CASE WHEN d.status = 'DELIVERED' THEN 1 ELSE 0 END) as completed_deliveries,
         COUNT(dr.id) as total_reviews,
         u.created_at
       FROM users u
       LEFT JOIN deliveries d ON u.id = d.driver_id
       LEFT JOIN delivery_reviews dr ON u.id = dr.driver_id
       WHERE u.role = 'driver'
       GROUP BY u.id, u.full_name, u.email, u.average_rating, u.created_at
       ORDER BY u.average_rating DESC NULLS LAST`
    );

    res.json({
      success: true,
      data: result.rows.map((row) => ({
        ...row,
        total_deliveries: parseInt(row.total_deliveries),
        completed_deliveries: parseInt(row.completed_deliveries),
        total_reviews: parseInt(row.total_reviews),
        completion_rate:
          row.total_deliveries > 0
            ? ((row.completed_deliveries / row.total_deliveries) * 100).toFixed(1)
            : 0,
      })),
    });
  } catch (err) {
    console.error('Get driver analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch driver analytics' });
  }
};

/**
 * Get reviews for moderation
 */
export const getReviewsForModeration = async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = parseInt(req.query.offset) || 0;
  const rating = req.query.rating; // Filter by rating (e.g., 1 or 2 for low ratings)

  try {
    let query = `SELECT dr.*, u.full_name as customer_name, d.driver_id,
                   driver.full_name as driver_name
                 FROM delivery_reviews dr
                 JOIN users u ON dr.customer_id = u.id
                 JOIN deliveries d ON dr.delivery_id = d.id
                 JOIN users driver ON dr.driver_id = driver.id
                 WHERE 1=1`;
    const params = [];

    // Low rating reviews (potential issues)
    if (rating) {
      query += ` AND dr.rating <= $${params.length + 1}`;
      params.push(rating);
    }

    // Get total count
    const countResult = await pool.query(
      query.replace(
        'SELECT dr.*, u.full_name as customer_name, d.driver_id, driver.full_name as driver_name',
        'SELECT COUNT(*) as total'
      ),
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get reviews with pagination
    const reviewsResult = await pool.query(
      query +
        ` ORDER BY dr.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: reviewsResult.rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (err) {
    console.error('Get reviews error:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
};

/**
 * Get delivery statistics by date
 */
export const getDeliveryStats = async (req, res) => {
  const days = Math.min(parseInt(req.query.days) || 30, 365);

  try {
    const result = await pool.query(
      `SELECT
         DATE(created_at) as date,
         COUNT(*) as total,
         SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as completed,
         SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled
       FROM deliveries
       WHERE created_at >= NOW() - INTERVAL '1 day' * $1
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [days]
    );

    res.json({
      success: true,
      data: result.rows.map((row) => ({
        ...row,
        total: parseInt(row.total),
        completed: parseInt(row.completed),
        cancelled: parseInt(row.cancelled),
      })),
    });
  } catch (err) {
    console.error('Get delivery stats error:', err);
    res.status(500).json({ error: 'Failed to fetch delivery statistics' });
  }
};

/**
 * Deactivate user account
 */
export const deactivateUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query(
      'UPDATE users SET is_active = false WHERE id = $1 RETURNING id, email, full_name',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      message: 'User deactivated successfully',
      data: result.rows[0],
    });
  } catch (err) {
    console.error('Deactivate user error:', err);
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
};

/**
 * Cancel delivery
 */
export const cancelDelivery = async (req, res) => {
  const { deliveryId } = req.params;
  const { reason } = req.body;

  try {
    const result = await pool.query(
      `UPDATE deliveries SET status = 'CANCELLED', updated_at = NOW()
       WHERE id = $1 AND status NOT IN ('DELIVERED', 'CANCELLED')
       RETURNING id, status`,
      [deliveryId]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Cannot cancel this delivery' });
    }

    res.json({
      success: true,
      message: 'Delivery cancelled successfully',
      data: result.rows[0],
    });
  } catch (err) {
    console.error('Cancel delivery error:', err);
    res.status(500).json({ error: 'Failed to cancel delivery' });
  }
};
