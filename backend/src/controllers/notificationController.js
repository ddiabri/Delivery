import {
  getUnreadNotifications,
  getNotificationHistory,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getUnreadCount,
  sendNotification
} from '../utils/notificationService.js';

/**
 * Get unread notifications for user
 */
export const getUnreadNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const notifications = await getUnreadNotifications(userId);

    res.status(200).json({
      notifications,
      count: notifications.length,
    });
  } catch (err) {
    console.error('Get unread notifications error:', err);
    res.status(500).json({
      error: 'Failed to get unread notifications',
      code: 'GET_ERROR',
    });
  }
};

/**
 * Get notification history with pagination
 */
export const getNotificationHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;

    const result = await getNotificationHistory(userId, parseInt(limit), parseInt(offset));

    res.status(200).json(result);
  } catch (err) {
    console.error('Get notification history error:', err);
    res.status(500).json({
      error: 'Failed to get notification history',
      code: 'GET_ERROR',
    });
  }
};

/**
 * Mark notification as read
 */
export const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const notificationResult = await getNotificationHistory(userId, 1000, 0);
    const notification = notificationResult.notifications.find(n => n.id === notificationId);

    if (!notification) {
      return res.status(404).json({
        error: 'Notification not found',
        code: 'NOT_FOUND',
      });
    }

    const updated = await markNotificationAsRead(notificationId);

    res.status(200).json({
      message: 'Notification marked as read',
      notification: updated,
    });
  } catch (err) {
    console.error('Mark as read error:', err);
    res.status(500).json({
      error: 'Failed to mark notification as read',
      code: 'UPDATE_ERROR',
    });
  }
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    await markAllNotificationsAsRead(userId);

    res.status(200).json({
      message: 'All notifications marked as read',
    });
  } catch (err) {
    console.error('Mark all as read error:', err);
    res.status(500).json({
      error: 'Failed to mark all notifications as read',
      code: 'UPDATE_ERROR',
    });
  }
};

/**
 * Delete notification
 */
export const deleteNotificationHandler = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const notificationResult = await getNotificationHistory(userId, 1000, 0);
    const notification = notificationResult.notifications.find(n => n.id === notificationId);

    if (!notification) {
      return res.status(404).json({
        error: 'Notification not found',
        code: 'NOT_FOUND',
      });
    }

    await deleteNotification(notificationId);

    res.status(200).json({
      message: 'Notification deleted',
    });
  } catch (err) {
    console.error('Delete notification error:', err);
    res.status(500).json({
      error: 'Failed to delete notification',
      code: 'DELETE_ERROR',
    });
  }
};

/**
 * Get unread count
 */
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const count = await getUnreadCount(userId);

    res.status(200).json({
      unreadCount: count,
    });
  } catch (err) {
    console.error('Get unread count error:', err);
    res.status(500).json({
      error: 'Failed to get unread count',
      code: 'GET_ERROR',
    });
  }
};

export default {
  getUnreadNotifications,
  getNotificationHistory,
  markAsRead,
  markAllAsRead,
  deleteNotificationHandler,
  getUnreadCount,
};
