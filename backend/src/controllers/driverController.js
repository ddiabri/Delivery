import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Get available deliveries for driver
 */
export const getAvailableDeliveries = async (req, res) => {
  try {
    const { latitude, longitude, limit = 20, offset = 0 } = req.validated;

    let sql = `
      SELECT
        d.id, d.customer_id, d.status, d.priority,
        d.pickup_address, ST_X(d.pickup_location) as pickup_longitude,
        ST_Y(d.pickup_location) as pickup_latitude,
        d.delivery_address, ST_X(d.delivery_location) as delivery_longitude,
        ST_Y(d.delivery_location) as delivery_latitude,
        d.package_description, d.package_weight,
        d.estimated_delivery_time, d.special_instructions,
        d.created_at,
        c.full_name as customer_name, c.phone as customer_phone,
        ST_Distance(
          d.pickup_location::geography,
          ST_Point($1, $2)::geography
        ) / 1000 as distance_km
      FROM deliveries d
      JOIN users c ON d.customer_id = c.id
      WHERE d.status = 'PENDING'
        AND ST_Distance(d.pickup_location::geography, ST_Point($1, $2)::geography) / 1000 <= $3
      ORDER BY distance_km ASC, d.priority DESC
      LIMIT $4 OFFSET $5
    `;

    const maxDistance = process.env.MAX_DELIVERY_DISTANCE_KM || 50;
    const result = await query(sql, [longitude, latitude, maxDistance, limit, offset]);

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM deliveries
       WHERE status = 'PENDING'
         AND ST_Distance(pickup_location::geography, ST_Point($1, $2)::geography) / 1000 <= $3`,
      [longitude, latitude, maxDistance]
    );

    const total = parseInt(countResult.rows[0].count);

    res.status(200).json({
      message: 'Available deliveries retrieved successfully',
      data: result.rows,
      pagination: {
        limit,
        offset,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Get available deliveries error:', err);
    res.status(500).json({
      error: 'Failed to fetch available deliveries',
      code: 'FETCH_ERROR',
    });
  }
};

/**
 * Update driver location
 */
export const updateDriverLocation = async (req, res) => {
  try {
    const driverId = req.user.id;
    const { latitude, longitude, bearing, speed, accuracy } = req.validated;

    const locationId = uuidv4();

    const result = await query(
      `INSERT INTO driver_locations (id, driver_id, location, bearing, speed, accuracy)
       VALUES ($1, $2, ST_Point($3, $4), $5, $6, $7)
       RETURNING id, driver_id, bearing, speed, accuracy, timestamp`,
      [locationId, driverId, longitude, latitude, bearing, speed, accuracy]
    );

    res.status(201).json({
      message: 'Location updated successfully',
      location: result.rows[0],
    });
  } catch (err) {
    console.error('Update location error:', err);
    res.status(500).json({
      error: 'Failed to update location',
      code: 'UPDATE_ERROR',
    });
  }
};

/**
 * Get driver statistics
 */
export const getDriverStats = async (req, res) => {
  try {
    const driverId = req.user.id;

    // Get delivery stats
    const statsResult = await query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'DELIVERED') as completed_deliveries,
        COUNT(*) FILTER (WHERE status = 'IN_TRANSIT' OR status = 'ACCEPTED' OR status = 'PICKED_UP') as active_deliveries,
        COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled_deliveries,
        COALESCE(AVG(dr.rating), 0) as average_rating,
        COUNT(DISTINCT delivery_id) as total_deliveries
      FROM deliveries
      LEFT JOIN delivery_reviews dr ON deliveries.id = dr.delivery_id
      WHERE driver_id = $1`,
      [driverId]
    );

    // Get recent deliveries
    const recentResult = await query(
      `SELECT
        id, status, priority, estimated_delivery_time,
        actual_delivery_time, created_at
      FROM deliveries
      WHERE driver_id = $1
      ORDER BY created_at DESC
      LIMIT 10`,
      [driverId]
    );

    const stats = statsResult.rows[0];

    res.status(200).json({
      message: 'Driver statistics retrieved successfully',
      stats: {
        completed_deliveries: parseInt(stats.completed_deliveries || 0),
        active_deliveries: parseInt(stats.active_deliveries || 0),
        cancelled_deliveries: parseInt(stats.cancelled_deliveries || 0),
        average_rating: parseFloat(stats.average_rating || 0),
        total_deliveries: parseInt(stats.total_deliveries || 0),
      },
      recent_deliveries: recentResult.rows,
    });
  } catch (err) {
    console.error('Get driver stats error:', err);
    res.status(500).json({
      error: 'Failed to fetch driver statistics',
      code: 'FETCH_ERROR',
    });
  }
};

/**
 * Get driver's active deliveries
 */
export const getActiveDeliveries = async (req, res) => {
  try {
    const driverId = req.user.id;

    const result = await query(
      `SELECT
        d.id, d.customer_id, d.status,
        d.pickup_address, ST_X(d.pickup_location) as pickup_longitude,
        ST_Y(d.pickup_location) as pickup_latitude,
        d.delivery_address, ST_X(d.delivery_location) as delivery_longitude,
        ST_Y(d.delivery_location) as delivery_latitude,
        d.package_description, d.priority,
        d.estimated_delivery_time, d.special_instructions,
        d.created_at, d.updated_at,
        c.full_name as customer_name, c.phone as customer_phone,
        c.address as customer_address
      FROM deliveries d
      JOIN users c ON d.customer_id = c.id
      WHERE d.driver_id = $1 AND d.status IN ('ACCEPTED', 'PICKED_UP', 'IN_TRANSIT')
      ORDER BY d.estimated_delivery_time ASC`,
      [driverId]
    );

    res.status(200).json({
      message: 'Active deliveries retrieved successfully',
      data: result.rows,
    });
  } catch (err) {
    console.error('Get active deliveries error:', err);
    res.status(500).json({
      error: 'Failed to fetch active deliveries',
      code: 'FETCH_ERROR',
    });
  }
};

export default {
  getAvailableDeliveries,
  updateDriverLocation,
  getDriverStats,
  getActiveDeliveries,
};
