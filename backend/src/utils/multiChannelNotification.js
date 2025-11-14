import { sendNotification } from './notificationService.js';
import { sendSMS, sendWhatsApp, sendSMSWithMedia, sendWhatsAppWithMedia, logDeliveryAttempt } from './twilioService.js';
import { query } from '../config/database.js';

/**
 * Get user notification preferences
 */
export const getUserPreferences = async (userId) => {
  try {
    const result = await query(
      'SELECT * FROM user_notification_preferences WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      // Create default preferences if not exists
      await query(
        `INSERT INTO user_notification_preferences (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );
      return {
        email_notifications: true,
        sms_notifications: false,
        whatsapp_notifications: false,
        in_app_notifications: true,
        browser_notifications: true,
        delivery_status_updates: true,
        points_alerts: true,
        promotional: false,
        phone_number: null,
        phone_verified: false,
      };
    }

    return result.rows[0];
  } catch (err) {
    console.error('Error getting user preferences:', err);
    throw err;
  }
};

/**
 * Send notification across all enabled channels
 */
export const sendMultiChannelNotification = async (userId, notification) => {
  try {
    const preferences = await getUserPreferences(userId);
    const results = {
      inApp: null,
      browser: null,
      sms: null,
      whatsApp: null,
      email: null,
    };

    // Check notification type against preferences
    const shouldSendStatusUpdate = notification.type?.includes('DELIVERY') && preferences.delivery_status_updates;
    const shouldSendPoints = notification.type === 'POINTS_EARNED' && preferences.points_alerts;
    const isPromo = notification.type?.includes('PROMO') || notification.type === 'REWARD_AVAILABLE';

    if ((shouldSendStatusUpdate || shouldSendPoints || (isPromo && preferences.promotional)) || !notification.type?.includes('DELIVERY')) {
      // In-app notification (always send if enabled)
      if (preferences.in_app_notifications) {
        try {
          results.inApp = await sendNotification(userId, notification);
        } catch (err) {
          console.error('Error sending in-app notification:', err);
        }
      }

      // Browser notification (always send if enabled)
      if (preferences.browser_notifications) {
        await logDeliveryAttempt(userId, null, 'BROWSER', 'SENT', notification.type, 'browser', JSON.stringify(notification));
        results.browser = true;
      }

      // SMS notification
      if (preferences.sms_notifications && preferences.phone_number && preferences.phone_verified) {
        try {
          const smsMessage = formatSMSMessage(notification);
          results.sms = await sendSMS(userId, preferences.phone_number, smsMessage, notification.type);
        } catch (err) {
          console.error('Error sending SMS:', err);
        }
      }

      // WhatsApp notification
      if (preferences.whatsapp_notifications && preferences.phone_number && preferences.phone_verified) {
        try {
          const waMessage = formatWhatsAppMessage(notification);
          results.whatsApp = await sendWhatsApp(userId, preferences.phone_number, waMessage, notification.type);
        } catch (err) {
          console.error('Error sending WhatsApp:', err);
        }
      }
    }

    console.log(`[MultiChannel] Notification sent to user ${userId}: `, results);
    return results;
  } catch (err) {
    console.error('Error sending multi-channel notification:', err);
    throw err;
  }
};

/**
 * Format notification for SMS
 */
const formatSMSMessage = (notification) => {
  const { title, body } = notification;
  // SMS has 160 char limit, so keep it concise
  return `${title} - ${body}`.substring(0, 155);
};

/**
 * Format notification for WhatsApp
 */
const formatWhatsAppMessage = (notification) => {
  const { title, body } = notification;
  return `*${title}*\n\n${body}`;
};

/**
 * Send delivery status updates across channels
 */
export const sendDeliveryStatusUpdate = async (delivery, newStatus) => {
  try {
    const statusMessages = {
      PENDING: {
        title: '📦 Delivery Request Created',
        body: `Your delivery from ${delivery.pickup_address} to ${delivery.delivery_address} has been created.`,
      },
      ACCEPTED: {
        title: '✅ Driver Accepted',
        body: `A driver has accepted your delivery. Track in real-time.`,
      },
      PICKED_UP: {
        title: '📍 Package Picked Up',
        body: `Your package is on its way to ${delivery.delivery_address}.`,
      },
      IN_TRANSIT: {
        title: '🚗 Driver on the Way',
        body: `Driver is currently en route to your location.`,
      },
      DELIVERED: {
        title: '🎉 Delivery Completed',
        body: `Package delivered to ${delivery.delivery_address}. Thank you!`,
      },
      CANCELLED: {
        title: '❌ Delivery Cancelled',
        body: 'Your delivery has been cancelled. Contact support for details.',
      },
    };

    const notification = statusMessages[newStatus];
    if (!notification) return;

    // Send to customer
    if (delivery.customer_id) {
      await sendMultiChannelNotification(delivery.customer_id, {
        type: `DELIVERY_${newStatus}`,
        title: notification.title,
        body: notification.body,
        deliveryId: delivery.id,
        actionUrl: `/delivery/${delivery.id}`,
        icon: '📦',
      });
    }

    // Send to driver for important updates
    if (delivery.driver_id && ['PICKED_UP', 'IN_TRANSIT', 'DELIVERED'].includes(newStatus)) {
      await sendMultiChannelNotification(delivery.driver_id, {
        type: `DELIVERY_${newStatus}`,
        title: 'Delivery Update',
        body: `Status updated to ${newStatus}`,
        deliveryId: delivery.id,
        actionUrl: `/delivery/${delivery.id}`,
        icon: '📦',
      });
    }
  } catch (err) {
    console.error('Error sending delivery status update:', err);
  }
};

/**
 * Send points earned notification
 */
export const sendPointsEarnedNotification = async (userId, points, reason) => {
  try {
    await sendMultiChannelNotification(userId, {
      type: 'POINTS_EARNED',
      title: `🎯 You Earned ${points} Points!`,
      body: `Earned ${points} points for ${reason}.`,
      actionUrl: '/points/history',
      icon: '⭐',
    });
  } catch (err) {
    console.error('Error sending points notification:', err);
  }
};

/**
 * Send promo notification
 */
export const sendPromoNotification = async (userId, promoTitle, promoBody) => {
  try {
    await sendMultiChannelNotification(userId, {
      type: 'PROMO',
      title: `🎁 ${promoTitle}`,
      body: promoBody,
      actionUrl: '/rewards',
      icon: '🎁',
    });
  } catch (err) {
    console.error('Error sending promo notification:', err);
  }
};

/**
 * Send bulk notifications to multiple users
 */
export const sendBulkMultiChannelNotifications = async (userIds, notification) => {
  try {
    const results = [];
    for (const userId of userIds) {
      const result = await sendMultiChannelNotification(userId, notification);
      results.push(result);
    }
    return results;
  } catch (err) {
    console.error('Error sending bulk notifications:', err);
    throw err;
  }
};
