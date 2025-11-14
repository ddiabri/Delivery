import pool from '../config/database.js';
import { generateGuestToken, validateGuestInfo, generateGuestTrackingLink } from '../utils/guestUtils.js';

/**
 * Create a delivery request as a guest (unauthenticated)
 * @route POST /api/guest/deliveries
 * @body {
 *   pickup_address, pickup_latitude, pickup_longitude,
 *   delivery_address, delivery_latitude, delivery_longitude,
 *   package_description, package_weight, priority,
 *   special_instructions, guest_name, guest_email, guest_phone
 * }
 */
export const createGuestDelivery = async (req, res) => {
  try {
    const {
      pickup_address,
      pickup_latitude,
      pickup_longitude,
      delivery_address,
      delivery_latitude,
      delivery_longitude,
      package_description,
      package_weight,
      priority,
      special_instructions,
      guest_name,
      guest_email,
      guest_phone,
    } = req.body;

    // Validate required fields
    if (!pickup_address || !pickup_latitude || !pickup_longitude) {
      return res.status(400).json({ error: 'Pickup location is required' });
    }

    if (!delivery_address || !delivery_latitude || !delivery_longitude) {
      return res.status(400).json({ error: 'Delivery location is required' });
    }

    if (!package_description || package_description.trim().length === 0) {
      return res.status(400).json({ error: 'Package description is required' });
    }

    // Validate guest information
    const guestValidation = validateGuestInfo(guest_name, guest_email, guest_phone);
    if (!guestValidation.isValid) {
      return res.status(400).json({ error: guestValidation.errors.join(', ') });
    }

    // Generate guest token for tracking
    const guestToken = generateGuestToken();

    // Create delivery with guest information
    const result = await pool.query(
      `INSERT INTO deliveries (
        pickup_address, pickup_location,
        delivery_address, delivery_location,
        package_description, package_weight, priority,
        special_instructions,
        guest_name, guest_email, guest_phone, guest_token,
        status
      ) VALUES (
        $1, ST_GeomFromText('POINT($2 $3)', 4326),
        $4, ST_GeomFromText('POINT($5 $6)', 4326),
        $7, $8, $9,
        $10,
        $11, $12, $13, $14,
        'PENDING'
      ) RETURNING *`,
      [
        pickup_address,
        pickup_longitude,
        pickup_latitude,
        delivery_address,
        delivery_longitude,
        delivery_latitude,
        package_description,
        package_weight ? parseFloat(package_weight) : null,
        priority || 'NORMAL',
        special_instructions || '',
        guest_name,
        guest_email || null,
        guest_phone,
        guestToken,
      ]
    );

    const delivery = result.rows[0];

    // Generate tracking link
    const trackingLink = generateGuestTrackingLink(delivery.id, guestToken);

    res.status(201).json({
      success: true,
      data: {
        deliveryId: delivery.id,
        guestToken,
        guestName: delivery.guest_name,
        guestPhone: delivery.guest_phone,
        trackingLink,
        status: delivery.status,
        message: `Delivery request created successfully. Use this link to track: ${trackingLink}`,
      },
    });
  } catch (err) {
    console.error('Error creating guest delivery:', err);
    res.status(500).json({ error: 'Failed to create delivery' });
  }
};

/**
 * Get guest delivery details by ID and token
 * @route GET /api/guest/deliveries/:deliveryId?token=GUEST_TOKEN
 */
export const getGuestDelivery = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Guest token is required' });
    }

    // Get delivery and verify guest token
    const result = await pool.query(
      `SELECT
        id, guest_name, guest_email, guest_phone,
        pickup_address, delivery_address,
        package_description, package_weight,
        status, priority,
        driver_id,
        (SELECT full_name FROM users WHERE id = deliveries.driver_id) as driver_name,
        (SELECT phone FROM users WHERE id = deliveries.driver_id) as driver_phone,
        (SELECT average_rating FROM users WHERE id = deliveries.driver_id) as driver_rating,
        estimated_delivery_time, actual_delivery_time,
        created_at, updated_at
       FROM deliveries
       WHERE id = $1 AND guest_token = $2`,
      [deliveryId, token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Delivery not found or invalid token' });
    }

    const delivery = result.rows[0];

    res.json({
      success: true,
      data: {
        deliveryId: delivery.id,
        guestName: delivery.guest_name,
        guestEmail: delivery.guest_email,
        guestPhone: delivery.guest_phone,
        pickupAddress: delivery.pickup_address,
        deliveryAddress: delivery.delivery_address,
        packageDescription: delivery.package_description,
        packageWeight: delivery.package_weight,
        priority: delivery.priority,
        status: delivery.status,
        driverId: delivery.driver_id,
        driverName: delivery.driver_name,
        driverPhone: delivery.driver_phone,
        driverRating: delivery.driver_rating,
        estimatedDeliveryTime: delivery.estimated_delivery_time,
        actualDeliveryTime: delivery.actual_delivery_time,
        createdAt: delivery.created_at,
        updatedAt: delivery.updated_at,
      },
    });
  } catch (err) {
    console.error('Error getting guest delivery:', err);
    res.status(500).json({ error: 'Failed to get delivery details' });
  }
};

/**
 * Cancel guest delivery request
 * @route POST /api/guest/deliveries/:deliveryId/cancel
 * @body { token: GUEST_TOKEN }
 */
export const cancelGuestDelivery = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Guest token is required' });
    }

    // Verify guest token and check if delivery can be cancelled
    const checkResult = await pool.query(
      'SELECT status FROM deliveries WHERE id = $1 AND guest_token = $2',
      [deliveryId, token]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Delivery not found or invalid token' });
    }

    const delivery = checkResult.rows[0];

    // Only allow cancellation for PENDING and ACCEPTED deliveries
    if (!['PENDING', 'ACCEPTED'].includes(delivery.status)) {
      return res.status(400).json({
        error: `Cannot cancel delivery with status: ${delivery.status}`,
      });
    }

    // Update delivery status
    const updateResult = await pool.query(
      'UPDATE deliveries SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['CANCELLED', deliveryId]
    );

    res.json({
      success: true,
      data: {
        deliveryId: updateResult.rows[0].id,
        status: updateResult.rows[0].status,
        message: 'Delivery request cancelled successfully',
      },
    });
  } catch (err) {
    console.error('Error cancelling guest delivery:', err);
    res.status(500).json({ error: 'Failed to cancel delivery' });
  }
};
