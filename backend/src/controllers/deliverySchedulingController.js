import { query } from '../config/database.js';

/**
 * Create a scheduled delivery
 */
export const createScheduledDelivery = async (req, res) => {
  try {
    const customerId = req.user.id;
    const {
      pickupAddress,
      pickupLocation,
      deliveryAddress,
      deliveryLocation,
      packageDescription,
      packageWeight,
      packageDimensions,
      priority,
      scheduledPickupTime,
      scheduledDeliveryTime,
      specialInstructions,
    } = req.body;

    // Validate scheduled times are in the future
    const pickupTime = new Date(scheduledPickupTime);
    const deliveryTime = new Date(scheduledDeliveryTime);
    const now = new Date();

    if (pickupTime <= now) {
      return res.status(400).json({ error: 'Pickup time must be in the future' });
    }

    if (deliveryTime <= pickupTime) {
      return res.status(400).json({ error: 'Delivery time must be after pickup time' });
    }

    const result = await query(
      `INSERT INTO scheduled_deliveries (
        customer_id, pickup_address, pickup_location, delivery_address, delivery_location,
        package_description, package_weight, package_dimensions, priority,
        scheduled_pickup_time, scheduled_delivery_time, special_instructions, status
      )
      VALUES ($1, $2, ST_GeomFromText($3, 4326), $4, ST_GeomFromText($5, 4326),
              $6, $7, $8, $9, $10, $11, $12, 'SCHEDULED')
      RETURNING *`,
      [
        customerId,
        pickupAddress,
        `POINT(${pickupLocation.longitude} ${pickupLocation.latitude})`,
        deliveryAddress,
        `POINT(${deliveryLocation.longitude} ${deliveryLocation.latitude})`,
        packageDescription,
        packageWeight,
        packageDimensions,
        priority || 'NORMAL',
        pickupTime,
        deliveryTime,
        specialInstructions,
      ]
    );

    res.status(201).json({
      message: 'Delivery scheduled successfully',
      scheduledDelivery: result.rows[0],
    });
  } catch (err) {
    console.error('Error creating scheduled delivery:', err);
    res.status(500).json({ error: 'Failed to schedule delivery' });
  }
};

/**
 * Get all scheduled deliveries for a user
 */
export const getScheduledDeliveries = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { status = 'SCHEDULED' } = req.query;

    const result = await query(
      `SELECT id, customer_id, driver_id, pickup_address, delivery_address,
              package_description, package_weight, priority, status,
              scheduled_pickup_time, scheduled_delivery_time, special_instructions,
              created_at, updated_at
       FROM scheduled_deliveries
       WHERE customer_id = $1 AND ($2::text IS NULL OR status = $2::text)
       ORDER BY scheduled_pickup_time DESC`,
      [customerId, status || null]
    );

    res.json({
      scheduledDeliveries: result.rows,
    });
  } catch (err) {
    console.error('Error fetching scheduled deliveries:', err);
    res.status(500).json({ error: 'Failed to fetch scheduled deliveries' });
  }
};

/**
 * Get a specific scheduled delivery
 */
export const getScheduledDeliveryById = async (req, res) => {
  try {
    const { id } = req.params;
    const customerId = req.user.id;

    const result = await query(
      `SELECT * FROM scheduled_deliveries WHERE id = $1 AND customer_id = $2`,
      [id, customerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Scheduled delivery not found' });
    }

    res.json({ scheduledDelivery: result.rows[0] });
  } catch (err) {
    console.error('Error fetching scheduled delivery:', err);
    res.status(500).json({ error: 'Failed to fetch scheduled delivery' });
  }
};

/**
 * Update a scheduled delivery
 */
export const updateScheduledDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const customerId = req.user.id;
    const {
      pickupAddress,
      pickupLocation,
      deliveryAddress,
      deliveryLocation,
      packageDescription,
      packageWeight,
      priority,
      scheduledPickupTime,
      scheduledDeliveryTime,
      specialInstructions,
    } = req.body;

    // Check if scheduled delivery belongs to user and hasn't been converted
    const checkResult = await query(
      `SELECT status FROM scheduled_deliveries WHERE id = $1 AND customer_id = $2`,
      [id, customerId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Scheduled delivery not found' });
    }

    if (checkResult.rows[0].status === 'CONVERTED') {
      return res.status(400).json({ error: 'Cannot update a scheduled delivery that has been converted' });
    }

    // Build dynamic update query
    const updates = [];
    const params = [id, customerId];
    let paramIndex = 3;

    if (pickupAddress) {
      updates.push(`pickup_address = $${paramIndex}`);
      params.push(pickupAddress);
      paramIndex++;
    }

    if (pickupLocation) {
      updates.push(`pickup_location = ST_GeomFromText($${paramIndex}, 4326)`);
      params.push(`POINT(${pickupLocation.longitude} ${pickupLocation.latitude})`);
      paramIndex++;
    }

    if (deliveryAddress) {
      updates.push(`delivery_address = $${paramIndex}`);
      params.push(deliveryAddress);
      paramIndex++;
    }

    if (deliveryLocation) {
      updates.push(`delivery_location = ST_GeomFromText($${paramIndex}, 4326)`);
      params.push(`POINT(${deliveryLocation.longitude} ${deliveryLocation.latitude})`);
      paramIndex++;
    }

    if (packageDescription) {
      updates.push(`package_description = $${paramIndex}`);
      params.push(packageDescription);
      paramIndex++;
    }

    if (packageWeight) {
      updates.push(`package_weight = $${paramIndex}`);
      params.push(packageWeight);
      paramIndex++;
    }

    if (priority) {
      updates.push(`priority = $${paramIndex}`);
      params.push(priority);
      paramIndex++;
    }

    if (scheduledPickupTime) {
      updates.push(`scheduled_pickup_time = $${paramIndex}`);
      params.push(new Date(scheduledPickupTime));
      paramIndex++;
    }

    if (scheduledDeliveryTime) {
      updates.push(`scheduled_delivery_time = $${paramIndex}`);
      params.push(new Date(scheduledDeliveryTime));
      paramIndex++;
    }

    if (specialInstructions) {
      updates.push(`special_instructions = $${paramIndex}`);
      params.push(specialInstructions);
      paramIndex++;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updates.length === 1) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const result = await query(
      `UPDATE scheduled_deliveries
       SET ${updates.join(', ')}
       WHERE id = $1 AND customer_id = $2
       RETURNING *`,
      params
    );

    res.json({
      message: 'Scheduled delivery updated successfully',
      scheduledDelivery: result.rows[0],
    });
  } catch (err) {
    console.error('Error updating scheduled delivery:', err);
    res.status(500).json({ error: 'Failed to update scheduled delivery' });
  }
};

/**
 * Cancel a scheduled delivery
 */
export const cancelScheduledDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const customerId = req.user.id;
    const { notes } = req.body;

    const result = await query(
      `UPDATE scheduled_deliveries
       SET status = 'CANCELLED', notes = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND customer_id = $2 AND status != 'CONVERTED'
       RETURNING *`,
      [id, customerId, notes || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Scheduled delivery not found or cannot be cancelled' });
    }

    res.json({
      message: 'Scheduled delivery cancelled successfully',
      scheduledDelivery: result.rows[0],
    });
  } catch (err) {
    console.error('Error cancelling scheduled delivery:', err);
    res.status(500).json({ error: 'Failed to cancel scheduled delivery' });
  }
};

/**
 * Get upcoming scheduled deliveries (admin view)
 */
export const getUpcomingScheduledDeliveries = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { daysAhead = 7 } = req.query;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(daysAhead));

    const result = await query(
      `SELECT
        sd.*,
        c.full_name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone
       FROM scheduled_deliveries sd
       JOIN users c ON sd.customer_id = c.id
       WHERE sd.status = 'SCHEDULED'
         AND sd.scheduled_pickup_time BETWEEN CURRENT_TIMESTAMP AND $1
       ORDER BY sd.scheduled_pickup_time ASC`,
      [futureDate]
    );

    res.json({
      upcomingDeliveries: result.rows,
    });
  } catch (err) {
    console.error('Error fetching upcoming scheduled deliveries:', err);
    res.status(500).json({ error: 'Failed to fetch upcoming deliveries' });
  }
};

/**
 * Convert scheduled delivery to actual delivery
 */
export const convertScheduledDelivery = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is admin or system process
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get scheduled delivery
    const scheduledResult = await query(
      `SELECT * FROM scheduled_deliveries WHERE id = $1 AND status = 'SCHEDULED'`,
      [id]
    );

    if (scheduledResult.rows.length === 0) {
      return res.status(404).json({ error: 'Scheduled delivery not found or already converted' });
    }

    const scheduled = scheduledResult.rows[0];

    // Create actual delivery from scheduled delivery
    const deliveryResult = await query(
      `INSERT INTO deliveries (
        customer_id, pickup_address, pickup_location, delivery_address, delivery_location,
        package_description, package_weight, package_dimensions, priority,
        scheduled_pickup_time, scheduled_delivery_time, special_instructions, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'PENDING')
      RETURNING *`,
      [
        scheduled.customer_id,
        scheduled.pickup_address,
        scheduled.pickup_location,
        scheduled.delivery_address,
        scheduled.delivery_location,
        scheduled.package_description,
        scheduled.package_weight,
        scheduled.package_dimensions,
        scheduled.priority,
        scheduled.scheduled_pickup_time,
        scheduled.scheduled_delivery_time,
        scheduled.special_instructions,
      ]
    );

    // Update scheduled delivery with converted delivery ID
    await query(
      `UPDATE scheduled_deliveries
       SET status = 'CONVERTED', converted_delivery_id = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id, deliveryResult.rows[0].id]
    );

    res.json({
      message: 'Scheduled delivery converted to actual delivery',
      delivery: deliveryResult.rows[0],
    });
  } catch (err) {
    console.error('Error converting scheduled delivery:', err);
    res.status(500).json({ error: 'Failed to convert scheduled delivery' });
  }
};
