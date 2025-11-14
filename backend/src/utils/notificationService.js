import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

// Store active WebSocket connections
let io = null;

/**
 * Initialize WebSocket connection for real-time notifications
 */
export const initializeWebSocket = (socketIO) => {
  io = socketIO;
};

/**
 * Send notification and persist to database
 */
export const sendNotification = async (userId, notification) => {
  try {
    const {
      type,
      title,
      body,
      deliveryId = null,
      actionUrl = null,
      icon = null,
      data = {}
    } = notification;

    // Store in database
    const result = await query(
      `INSERT INTO notifications (id, user_id, delivery_id, type, title, body, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       RETURNING id, user_id, type, title, body, is_read, created_at`,
      [
        uuidv4(),
        userId,
        deliveryId,
        type,
        title,
        body,
        false
      ]
    );

    const notificationRecord = result.rows[0];

    // Send via WebSocket if connected
    if (io) {
      io.to(`user:${userId}`).emit('notification:new', {
        ...notificationRecord,
        actionUrl,
        icon,
        data
      });
    }

    return notificationRecord;
  } catch (err) {
    console.error('Error sending notification:', err);
    throw err;
  }
};

/**
 * Send bulk notifications to multiple users
 */
export const sendBulkNotifications = async (userIds, notification) => {
  try {
    const results = [];
    for (const userId of userIds) {
      const result = await sendNotification(userId, notification);
      results.push(result);
    }
    return results;
  } catch (err) {
    console.error('Error sending bulk notifications:', err);
    throw err;
  }
};

/**
 * Get unread notifications for user
 */
export const getUnreadNotifications = async (userId) => {
  try {
    const result = await query(
      `SELECT * FROM notifications
       WHERE user_id = $1 AND is_read = false
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );
    return result.rows;
  } catch (err) {
    console.error('Error getting unread notifications:', err);
    throw err;
  }
};

/**
 * Get notification history
 */
export const getNotificationHistory = async (userId, limit = 50, offset = 0) => {
  try {
    const result = await query(
      `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM notifications WHERE user_id = $1`,
      [userId]
    );

    return {
      notifications: result.rows,
      total: parseInt(countResult.rows[0].total),
      hasMore: offset + limit < parseInt(countResult.rows[0].total)
    };
  } catch (err) {
    console.error('Error getting notification history:', err);
    throw err;
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (notificationId) => {
  try {
    const result = await query(
      `UPDATE notifications
       SET is_read = true
       WHERE id = $1
       RETURNING *`,
      [notificationId]
    );
    return result.rows[0];
  } catch (err) {
    console.error('Error marking notification as read:', err);
    throw err;
  }
};

/**
 * Mark all notifications as read for user
 */
export const markAllNotificationsAsRead = async (userId) => {
  try {
    const result = await query(
      `UPDATE notifications
       SET is_read = true
       WHERE user_id = $1
       RETURNING COUNT(*) as updated`,
      [userId]
    );
    return result.rows[0];
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    throw err;
  }
};

/**
 * Delete notification
 */
export const deleteNotification = async (notificationId) => {
  try {
    await query(
      `DELETE FROM notifications WHERE id = $1`,
      [notificationId]
    );
  } catch (err) {
    console.error('Error deleting notification:', err);
    throw err;
  }
};

/**
 * Send delivery status notification
 */
export const sendDeliveryStatusNotification = async (delivery, newStatus) => {
  try {
    const notifications = {
      PENDING: {
        type: 'DELIVERY_CREATED',
        title: '📦 Delivery Request Created',
        body: `Your delivery from ${delivery.pickup_address} to ${delivery.delivery_address} has been created and is waiting for a driver.`,
      },
      ACCEPTED: {
        type: 'DELIVERY_ACCEPTED',
        title: '✅ Driver Accepted Your Delivery',
        body: `A driver has accepted your delivery. You can now track their location in real-time.`,
      },
      PICKED_UP: {
        type: 'DELIVERY_PICKED_UP',
        title: '📍 Package Picked Up',
        body: `Your package has been picked up and is on its way to ${delivery.delivery_address}.`,
      },
      IN_TRANSIT: {
        type: 'DELIVERY_IN_TRANSIT',
        title: '🚗 Driver on the Way',
        body: `Your driver is currently en route to deliver your package.`,
      },
      DELIVERED: {
        type: 'DELIVERY_DELIVERED',
        title: '🎉 Delivery Completed',
        body: `Your package has been successfully delivered to ${delivery.delivery_address}.`,
      },
      CANCELLED: {
        type: 'DELIVERY_CANCELLED',
        title: '❌ Delivery Cancelled',
        body: 'Your delivery has been cancelled. Please contact support for more information.',
      }
    };

    const notification = notifications[newStatus];
    if (!notification) return;

    // Notify customer
    if (delivery.customer_id) {
      await sendNotification(delivery.customer_id, {
        ...notification,
        deliveryId: delivery.id,
        actionUrl: `/delivery/${delivery.id}`,
        icon: '📦'
      });
    }

    // Notify driver for status updates they should know about
    if (delivery.driver_id && ['PICKED_UP', 'IN_TRANSIT', 'DELIVERED'].includes(newStatus)) {
      await sendNotification(delivery.driver_id, {
        type: notification.type,
        title: `Delivery Update: ${newStatus}`,
        body: `Your delivery to ${delivery.delivery_address} status has been updated to ${newStatus}.`,
        deliveryId: delivery.id,
        actionUrl: `/delivery/${delivery.id}`,
        icon: '📦'
      });
    }
  } catch (err) {
    console.error('Error sending delivery status notification:', err);
    // Don't throw, just log - don't want notification issues to break delivery updates
  }
};

/**
 * Send points earned notification
 */
export const sendPointsNotification = async (userId, points, reason) => {
  try {
    await sendNotification(userId, {
      type: 'POINTS_EARNED',
      title: `🎯 You Earned ${points} Points!`,
      body: `You've earned ${points} points for ${reason}.`,
      actionUrl: '/points/history',
      icon: '⭐'
    });
  } catch (err) {
    console.error('Error sending points notification:', err);
  }
};

/**
 * Send reward availability notification
 */
export const sendRewardNotification = async (userId, rewardName) => {
  try {
    await sendNotification(userId, {
      type: 'REWARD_AVAILABLE',
      title: '🎁 New Reward Available',
      body: `You can now redeem ${rewardName}! Visit the rewards section to claim it.`,
      actionUrl: '/rewards',
      icon: '🎁'
    });
  } catch (err) {
    console.error('Error sending reward notification:', err);
  }
};

/**
 * Get unread notification count
 */
export const getUnreadCount = async (userId) => {
  try {
    const result = await query(
      `SELECT COUNT(*) as count FROM notifications
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    return parseInt(result.rows[0].count);
  } catch (err) {
    console.error('Error getting unread count:', err);
    throw err;
  }
};
