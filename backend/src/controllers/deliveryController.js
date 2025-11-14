import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import geolib from 'geolib';

/**
 * Create a new delivery request
 */
export const createDelivery = async (req, res) => {
  try {
    const customerId = req.user.id;
    const {
      pickup_address,
      pickup_latitude,
      pickup_longitude,
      delivery_address,
      delivery_latitude,
      delivery_longitude,
      package_description,
      package_weight,
      package_dimensions,
      priority = 'NORMAL',
      special_instructions,
    } = req.validated;

    // Validate distance
    const distance = geolib.getDistance(
      { latitude: pickup_latitude, longitude: pickup_longitude },
      { latitude: delivery_latitude, longitude: delivery_longitude }
    );

    const distanceKm = distance / 1000;
    const maxDistance = process.env.MAX_DELIVERY_DISTANCE_KM || 50;

    if (distanceKm > maxDistance) {
      return res.status(400).json({
        error: `Delivery distance exceeds maximum allowed distance (${maxDistance}km)`,
        code: 'DISTANCE_EXCEEDED',
        distance: distanceKm.toFixed(2),
      });
    }

    const deliveryId = uuidv4();
    const estimatedDeliveryTime = new Date(
      Date.now() + (process.env.DEFAULT_DELIVERY_TIME_MINUTES || 45) * 60 * 1000
    );

    const result = await query(
      `INSERT INTO deliveries (
        id, customer_id, pickup_address, pickup_location,
        delivery_address, delivery_location, package_description,
        package_weight, package_dimensions, status, priority,
        estimated_delivery_time, special_instructions
      )
      VALUES (
        $1, $2, $3, ST_Point($4, $5),
        $6, ST_Point($7, $8), $9,
        $10, $11, $12, $13, $14, $15
      )
      RETURNING id, customer_id, status, priority, estimated_delivery_time, created_at`,
      [
        deliveryId,
        customerId,
        pickup_address,
        pickup_longitude,
        pickup_latitude,
        delivery_address,
        delivery_longitude,
        delivery_latitude,
        package_description,
        package_weight,
        package_dimensions,
        'PENDING',
        priority,
        estimatedDeliveryTime,
        special_instructions,
      ]
    );

    const delivery = result.rows[0];

    res.status(201).json({
      message: 'Delivery request created successfully',
      delivery: {
        ...delivery,
        distance_km: distanceKm.toFixed(2),
      },
    });
  } catch (err) {
    console.error('Create delivery error:', err);
    res.status(500).json({
      error: 'Failed to create delivery',
      code: 'CREATE_ERROR',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

/**
 * Get deliveries based on user role
 */
export const getDeliveries = async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const { status, priority, limit = 20, offset = 0 } = req.validated;

    let sql = `
      SELECT
        d.id, d.customer_id, d.driver_id,
        d.pickup_address, ST_AsText(d.pickup_location) as pickup_location,
        d.delivery_address, ST_AsText(d.delivery_location) as delivery_location,
        d.package_description, d.package_weight, d.package_dimensions,
        d.status, d.priority, d.estimated_delivery_time,
        d.actual_delivery_time, d.special_instructions,
        d.created_at, d.updated_at,
        c.full_name as customer_name, c.phone as customer_phone,
        dr.full_name as driver_name, dr.phone as driver_phone
      FROM deliveries d
      JOIN users c ON d.customer_id = c.id
      LEFT JOIN users dr ON d.driver_id = dr.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    // Role-based filtering
    if (role === 'customer') {
      sql += ` AND d.customer_id = $${paramCount}`;
      params.push(userId);
      paramCount++;
    } else if (role === 'driver') {
      sql += ` AND (d.driver_id = $${paramCount} OR d.status = 'PENDING')`;
      params.push(userId);
      paramCount++;
    }

    // Status filter
    if (status) {
      sql += ` AND d.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    // Priority filter
    if (priority) {
      sql += ` AND d.priority = $${paramCount}`;
      params.push(priority);
      paramCount++;
    }

    sql += ` ORDER BY d.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await query(sql, params);
    const deliveries = result.rows;

    // Get total count
    let countSql = 'SELECT COUNT(*) FROM deliveries WHERE 1=1';
    const countParams = [];
    let countParamCount = 1;

    if (role === 'customer') {
      countSql += ` AND customer_id = $${countParamCount}`;
      countParams.push(userId);
      countParamCount++;
    } else if (role === 'driver') {
      countSql += ` AND (driver_id = $${countParamCount} OR status = 'PENDING')`;
      countParams.push(userId);
      countParamCount++;
    }

    if (status) {
      countSql += ` AND status = $${countParamCount}`;
      countParams.push(status);
      countParamCount++;
    }

    if (priority) {
      countSql += ` AND priority = $${countParamCount}`;
      countParams.push(priority);
      countParamCount++;
    }

    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.status(200).json({
      message: 'Deliveries retrieved successfully',
      data: deliveries,
      pagination: {
        limit,
        offset,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Get deliveries error:', err);
    res.status(500).json({
      error: 'Failed to fetch deliveries',
      code: 'FETCH_ERROR',
    });
  }
};

/**
 * Get delivery by ID
 */
export const getDeliveryById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    const result = await query(
      `SELECT
        d.id, d.customer_id, d.driver_id,
        d.pickup_address, ST_AsText(d.pickup_location) as pickup_location,
        d.delivery_address, ST_AsText(d.delivery_location) as delivery_location,
        d.package_description, d.package_weight, d.package_dimensions,
        d.status, d.priority, d.estimated_delivery_time,
        d.actual_delivery_time, d.special_instructions,
        d.created_at, d.updated_at,
        c.full_name as customer_name, c.phone as customer_phone,
        dr.full_name as driver_name, dr.phone as driver_phone
      FROM deliveries d
      JOIN users c ON d.customer_id = c.id
      LEFT JOIN users dr ON d.driver_id = dr.id
      WHERE d.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Delivery not found',
        code: 'NOT_FOUND',
      });
    }

    const delivery = result.rows[0];

    // Authorization check
    if (
      role === 'customer' && delivery.customer_id !== userId &&
      role === 'driver' && delivery.driver_id !== userId
    ) {
      return res.status(403).json({
        error: 'Unauthorized to view this delivery',
        code: 'FORBIDDEN',
      });
    }

    res.status(200).json({
      message: 'Delivery retrieved successfully',
      delivery,
    });
  } catch (err) {
    console.error('Get delivery error:', err);
    res.status(500).json({
      error: 'Failed to fetch delivery',
      code: 'FETCH_ERROR',
    });
  }
};

/**
 * Update delivery status
 */
export const updateDeliveryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.validated;
    const { role, id: userId } = req.user;

    // Get current delivery
    const deliveryResult = await query(
      'SELECT customer_id, driver_id, status FROM deliveries WHERE id = $1',
      [id]
    );

    if (deliveryResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Delivery not found',
        code: 'NOT_FOUND',
      });
    }

    const delivery = deliveryResult.rows[0];

    // Authorization checks
    if (status === 'ACCEPTED' || status === 'PICKED_UP' || status === 'IN_TRANSIT' || status === 'DELIVERED') {
      if (role !== 'driver' || delivery.driver_id !== userId) {
        return res.status(403).json({
          error: 'Only assigned driver can update this status',
          code: 'FORBIDDEN',
        });
      }
    }

    // Status transition validation
    const validTransitions = {
      PENDING: ['ACCEPTED', 'CANCELLED'],
      ACCEPTED: ['PICKED_UP', 'CANCELLED'],
      PICKED_UP: ['IN_TRANSIT', 'CANCELLED'],
      IN_TRANSIT: ['DELIVERED', 'CANCELLED'],
      DELIVERED: [],
      CANCELLED: [],
    };

    if (!validTransitions[delivery.status]?.includes(status)) {
      return res.status(400).json({
        error: `Cannot transition from ${delivery.status} to ${status}`,
        code: 'INVALID_TRANSITION',
        validTransitions: validTransitions[delivery.status],
      });
    }

    // Update delivery
    let sql = `
      UPDATE deliveries
      SET status = $1,
          updated_at = CURRENT_TIMESTAMP
    `;
    const params = [status, id];

    if (status === 'ACCEPTED') {
      sql += `, driver_id = $3`;
      params.push(userId);
    }

    if (status === 'DELIVERED') {
      sql += `, actual_delivery_time = CURRENT_TIMESTAMP`;
    }

    sql += ` WHERE id = $2
             RETURNING id, status, driver_id, updated_at`;

    const updateResult = await query(sql, params);
    const updatedDelivery = updateResult.rows[0];

    res.status(200).json({
      message: `Delivery status updated to ${status}`,
      delivery: updatedDelivery,
    });
  } catch (err) {
    console.error('Update delivery error:', err);
    res.status(500).json({
      error: 'Failed to update delivery',
      code: 'UPDATE_ERROR',
    });
  }
};

export default {
  createDelivery,
  getDeliveries,
  getDeliveryById,
  updateDeliveryStatus,
};
