import { pool } from '../config/database.js';

// Send push notification
export const sendPushNotification = async (userId, deliveryId, type, title, body) => {
  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, delivery_id, type, title, body)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [userId, deliveryId, type, title, body]
    );

    console.log(`✅ Notification sent to user ${userId}: ${type}`);
    return result.rows[0];
  } catch (err) {
    console.error('Notification error:', err);
    throw err;
  }
};

// Get user notifications
export const getUserNotifications = async (userId, limit = 20, offset = 0) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  } catch (err) {
    console.error('Get notifications error:', err);
    throw err;
  }
};

// Mark notification as read
export const markNotificationAsRead = async (notificationId) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1',
      [notificationId]
    );
  } catch (err) {
    console.error('Mark notification read error:', err);
    throw err;
  }
};

// Delivery status notifications
export const notifyDeliveryStatusChange = async (deliveryId, status) => {
  try {
    const deliveryResult = await pool.query(
      `SELECT customer_id, driver_id FROM deliveries WHERE id = $1`,
      [deliveryId]
    );

    if (deliveryResult.rows.length === 0) return;

    const { customer_id, driver_id } = deliveryResult.rows[0];

    const statusMessages = {
      ACCEPTED: { title: '🎉 Driver Accepted', body: 'A driver has accepted your delivery!' },
      PICKED_UP: { title: '📦 Package Picked Up', body: 'Your package has been picked up and is on the way!' },
      IN_TRANSIT: { title: '🚗 In Transit', body: 'Your delivery is currently in transit.' },
      DELIVERED: { title: '✓ Delivered', body: 'Your delivery has been completed!' },
    };

    const message = statusMessages[status];
    if (message) {
      // Notify customer
      await sendPushNotification(customer_id, deliveryId, 'delivery_status', message.title, message.body);

      // Notify driver
      if (driver_id) {
        await sendPushNotification(driver_id, deliveryId, 'delivery_status', message.title, message.body);
      }
    }
  } catch (err) {
    console.error('Notify delivery status error:', err);
  }
};
