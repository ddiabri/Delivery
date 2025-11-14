import { query } from '../config/database.js';

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c); // Distance in meters
};

const toRadians = (degrees) => {
  return degrees * (Math.PI / 180);
};

/**
 * Check if driver location triggers geofence event
 */
export const checkGeofenceEvents = async (
  driverId,
  deliveryId,
  customerId,
  currentLat,
  currentLon,
  socket
) => {
  try {
    // Get delivery location and geofence zone
    const deliveryResult = await query(
      `SELECT d.delivery_location, d.customer_id, gz.delivery_radius_meters
       FROM deliveries d
       LEFT JOIN geofence_zones gz ON d.id = gz.delivery_id
       WHERE d.id = $1`,
      [deliveryId]
    );

    if (deliveryResult.rows.length === 0) {
      return;
    }

    const delivery = deliveryResult.rows[0];
    const geofenceRadius = delivery.delivery_radius_meters || 500;

    // Extract coordinates from geography type
    // PostGIS returns coordinates as 'POINT(lon lat)'
    const locationStr = delivery.delivery_location;
    const coordsMatch = locationStr.match(/POINT\(([^ ]+) ([^ ]+)\)/);

    if (!coordsMatch) {
      console.error('Could not parse delivery location');
      return;
    }

    const deliveryLon = parseFloat(coordsMatch[1]);
    const deliveryLat = parseFloat(coordsMatch[2]);

    // Calculate distance
    const distanceMeters = calculateDistance(
      currentLat,
      currentLon,
      deliveryLat,
      deliveryLon
    );

    // Get last event for this delivery
    const lastEventResult = await query(
      `SELECT event_type, distance_meters FROM geofence_events
       WHERE delivery_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [deliveryId]
    );

    const lastEvent = lastEventResult.rows[0];
    let eventType = null;
    let shouldNotify = false;

    // Determine event type based on distance thresholds
    if (distanceMeters <= geofenceRadius && (!lastEvent || lastEvent.event_type !== 'ARRIVED')) {
      eventType = 'ARRIVED';
      shouldNotify = true;
    } else if (distanceMeters <= geofenceRadius * 2 && distanceMeters > geofenceRadius &&
      (!lastEvent || lastEvent.event_type !== 'APPROACHING')) {
      eventType = 'APPROACHING';
      shouldNotify = true;
    } else if (distanceMeters > geofenceRadius * 3 && lastEvent && lastEvent.event_type === 'ARRIVED') {
      eventType = 'DEPARTED';
      shouldNotify = true;
    } else if (distanceMeters > geofenceRadius * 5 && lastEvent && lastEvent.event_type === 'APPROACHING') {
      eventType = 'RADIUS_EXCEEDED';
      shouldNotify = true;
    }

    // Log geofence event
    if (eventType && shouldNotify) {
      const eventResult = await query(
        `INSERT INTO geofence_events (
          delivery_id, driver_id, customer_id, event_type,
          latitude, longitude, distance_meters, geofence_radius_meters, notification_sent
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
        RETURNING id, event_type, distance_meters`,
        [deliveryId, driverId, customerId, eventType, currentLat, currentLon, distanceMeters, geofenceRadius]
      );

      // Send notifications
      await sendGeofenceNotifications(
        socket,
        driverId,
        customerId,
        deliveryId,
        eventType,
        distanceMeters,
        eventResult.rows[0].id
      );

      return {
        eventType,
        distance: distanceMeters,
        radius: geofenceRadius
      };
    }

    return null;
  } catch (err) {
    console.error('Error checking geofence events:', err);
  }
};

/**
 * Send geofence notifications to driver and customer
 */
const sendGeofenceNotifications = async (
  socket,
  driverId,
  customerId,
  deliveryId,
  eventType,
  distance,
  geofenceEventId
) => {
  try {
    // Get user info
    const driverResult = await query(
      'SELECT full_name FROM users WHERE id = $1',
      [driverId]
    );

    const customerResult = await query(
      'SELECT full_name FROM users WHERE id = $1',
      [customerId]
    );

    const driverName = driverResult.rows[0]?.full_name || 'Driver';
    const customerName = customerResult.rows[0]?.full_name || 'Customer';

    // Create notification messages
    const notifications = {
      APPROACHING: {
        customer: {
          title: '🚗 Driver Approaching',
          message: `${driverName} is approaching your delivery location (${Math.round(distance / 1000 * 10) / 10} km away)`,
          type: 'DELIVERY_ALERT'
        },
        driver: {
          title: '📍 Delivery Approaching',
          message: `You're approaching the delivery location for ${customerName}`,
          type: 'DELIVERY_ALERT'
        }
      },
      ARRIVED: {
        customer: {
          title: '✅ Driver Arrived',
          message: `${driverName} has arrived at your delivery location`,
          type: 'DELIVERY_ARRIVED'
        },
        driver: {
          title: '📍 Delivery Reached',
          message: `You've reached the delivery location for ${customerName}`,
          type: 'DELIVERY_ARRIVED'
        }
      },
      DEPARTED: {
        customer: {
          title: '⚠️ Driver Departed',
          message: `${driverName} has left your delivery location`,
          type: 'DELIVERY_ALERT'
        },
        driver: {
          title: '📍 Delivery Departed',
          message: `You've left the delivery location for ${customerName}`,
          type: 'DELIVERY_ALERT'
        }
      },
      RADIUS_EXCEEDED: {
        customer: {
          title: '❌ Delivery Issue',
          message: 'Driver has gone too far from delivery location',
          type: 'DELIVERY_ALERT'
        },
        driver: {
          title: '❌ Out of Range',
          message: 'You are too far from the delivery location',
          type: 'DELIVERY_ALERT'
        }
      }
    };

    const notification = notifications[eventType];

    if (notification && socket) {
      // Notify customer
      socket.to(`user:${customerId}`).emit('geofence:alert', {
        deliveryId,
        eventType,
        ...notification.customer,
        distance,
        timestamp: new Date().toISOString()
      });

      // Notify driver
      socket.to(`user:${driverId}`).emit('geofence:alert', {
        deliveryId,
        eventType,
        ...notification.driver,
        distance,
        timestamp: new Date().toISOString()
      });

      // Mark notifications as sent
      await query(
        `UPDATE geofence_events
         SET notification_sent = true,
             customer_notified_at = CURRENT_TIMESTAMP,
             driver_notified_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [geofenceEventId]
      );

      console.log(`📍 Geofence alert sent: ${eventType} - Distance: ${distance}m`);
    }
  } catch (err) {
    console.error('Error sending geofence notifications:', err);
  }
};

/**
 * Get geofence events for a delivery
 */
export const getGeofenceEvents = async (req, res) => {
  try {
    const { deliveryId } = req.params;

    const result = await query(
      `SELECT id, event_type, distance_meters, latitude, longitude,
              customer_notified_at, driver_notified_at, created_at
       FROM geofence_events
       WHERE delivery_id = $1
       ORDER BY created_at DESC`,
      [deliveryId]
    );

    res.json({ events: result.rows });
  } catch (err) {
    console.error('Error getting geofence events:', err);
    res.status(500).json({ error: 'Failed to fetch geofence events' });
  }
};

/**
 * Get geofence zone for delivery
 */
export const getGeofenceZone = async (req, res) => {
  try {
    const { deliveryId } = req.params;

    const result = await query(
      `SELECT id, pickup_radius_meters, delivery_radius_meters, is_active
       FROM geofence_zones
       WHERE delivery_id = $1`,
      [deliveryId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Geofence zone not found' });
    }

    res.json({ zone: result.rows[0] });
  } catch (err) {
    console.error('Error getting geofence zone:', err);
    res.status(500).json({ error: 'Failed to fetch geofence zone' });
  }
};

/**
 * Create geofence zone for delivery
 */
export const createGeofenceZone = async (req, res) => {
  try {
    const { deliveryId, pickupRadius, deliveryRadius } = req.body;

    // Get delivery location
    const deliveryResult = await query(
      'SELECT delivery_location FROM deliveries WHERE id = $1',
      [deliveryId]
    );

    if (deliveryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    const result = await query(
      `INSERT INTO geofence_zones (
        delivery_id, pickup_radius_meters, delivery_radius_meters, delivery_location
      )
      VALUES ($1, $2, $3, $4)
      RETURNING id, pickup_radius_meters, delivery_radius_meters`,
      [deliveryId, pickupRadius || 500, deliveryRadius || 500, deliveryResult.rows[0].delivery_location]
    );

    res.status(201).json({
      message: 'Geofence zone created',
      zone: result.rows[0]
    });
  } catch (err) {
    console.error('Error creating geofence zone:', err);
    res.status(500).json({ error: 'Failed to create geofence zone' });
  }
};

/**
 * Get geofence statistics (admin)
 */
export const getGeofenceStats = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const statsResult = await query(`
      SELECT
        COUNT(DISTINCT delivery_id) as total_deliveries_tracked,
        COUNT(DISTINCT driver_id) as total_drivers_tracked,
        COUNT(CASE WHEN event_type = 'ARRIVED' THEN 1 END) as arrived_events,
        COUNT(CASE WHEN event_type = 'APPROACHING' THEN 1 END) as approaching_events,
        COUNT(CASE WHEN event_type = 'DEPARTED' THEN 1 END) as departed_events,
        COUNT(CASE WHEN notification_sent = true THEN 1 END) as notifications_sent,
        AVG(distance_meters) as avg_distance_at_arrival
      FROM geofence_events
      WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
    `);

    const eventBreakdown = await query(`
      SELECT
        event_type,
        COUNT(*) as count,
        AVG(distance_meters) as avg_distance
      FROM geofence_events
      WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
      GROUP BY event_type
    `);

    res.json({
      stats: statsResult.rows[0],
      eventBreakdown: eventBreakdown.rows
    });
  } catch (err) {
    console.error('Error getting geofence stats:', err);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};
