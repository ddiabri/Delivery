import { query } from '../config/database.js';
import { getUserPreferences } from '../utils/multiChannelNotification.js';
import {
  generatePhoneVerificationToken,
  verifyPhoneToken,
  sendVerificationSMS,
  getDeliveryLogs,
  getDeliveryStats,
  incrementVerificationAttempts,
} from '../utils/twilioService.js';

/**
 * Get notification preferences for user
 */
export const getPreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const preferences = await getUserPreferences(userId);

    // Don't send actual phone number (masked)
    const maskedPreferences = {
      ...preferences,
      phone_number: preferences.phone_number
        ? `${preferences.phone_number.slice(0, 3)}${'*'.repeat(preferences.phone_number.length - 6)}${preferences.phone_number.slice(-3)}`
        : null,
    };

    res.status(200).json({
      preferences: maskedPreferences,
    });
  } catch (err) {
    console.error('Get preferences error:', err);
    res.status(500).json({
      error: 'Failed to get notification preferences',
      code: 'GET_ERROR',
    });
  }
};

/**
 * Update notification preferences
 */
export const updatePreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      email_notifications,
      sms_notifications,
      whatsapp_notifications,
      in_app_notifications,
      browser_notifications,
      delivery_status_updates,
      points_alerts,
      promotional,
      weekly_digest,
    } = req.body;

    const updateFields = [];
    const updateParams = [userId];
    let paramCount = 2;

    if (email_notifications !== undefined) {
      updateFields.push(`email_notifications = $${paramCount}`);
      updateParams.push(email_notifications);
      paramCount++;
    }
    if (sms_notifications !== undefined) {
      updateFields.push(`sms_notifications = $${paramCount}`);
      updateParams.push(sms_notifications);
      paramCount++;
    }
    if (whatsapp_notifications !== undefined) {
      updateFields.push(`whatsapp_notifications = $${paramCount}`);
      updateParams.push(whatsapp_notifications);
      paramCount++;
    }
    if (in_app_notifications !== undefined) {
      updateFields.push(`in_app_notifications = $${paramCount}`);
      updateParams.push(in_app_notifications);
      paramCount++;
    }
    if (browser_notifications !== undefined) {
      updateFields.push(`browser_notifications = $${paramCount}`);
      updateParams.push(browser_notifications);
      paramCount++;
    }
    if (delivery_status_updates !== undefined) {
      updateFields.push(`delivery_status_updates = $${paramCount}`);
      updateParams.push(delivery_status_updates);
      paramCount++;
    }
    if (points_alerts !== undefined) {
      updateFields.push(`points_alerts = $${paramCount}`);
      updateParams.push(points_alerts);
      paramCount++;
    }
    if (promotional !== undefined) {
      updateFields.push(`promotional = $${paramCount}`);
      updateParams.push(promotional);
      paramCount++;
    }
    if (weekly_digest !== undefined) {
      updateFields.push(`weekly_digest = $${paramCount}`);
      updateParams.push(weekly_digest);
      paramCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: 'No preferences to update',
        code: 'EMPTY_UPDATE',
      });
    }

    const updateQuery = `
      UPDATE user_notification_preferences
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING *
    `;

    const result = await query(updateQuery, updateParams);

    res.status(200).json({
      message: 'Preferences updated successfully',
      preferences: result.rows[0],
    });
  } catch (err) {
    console.error('Update preferences error:', err);
    res.status(500).json({
      error: 'Failed to update preferences',
      code: 'UPDATE_ERROR',
    });
  }
};

/**
 * Start phone number verification
 */
export const startPhoneVerification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { phone_number } = req.validated;

    // Generate verification token
    const token = await generatePhoneVerificationToken(userId, phone_number);

    // Send verification SMS
    try {
      await sendVerificationSMS(phone_number, token);
    } catch (err) {
      console.warn('Could not send verification SMS:', err.message);
      // Continue - user can retry if SMS fails
    }

    res.status(200).json({
      message: 'Verification code sent to your phone',
      expiresIn: 600, // 10 minutes
    });
  } catch (err) {
    console.error('Start phone verification error:', err);
    res.status(500).json({
      error: 'Failed to start phone verification',
      code: 'VERIFICATION_ERROR',
    });
  }
};

/**
 * Verify phone number with token
 */
export const verifyPhoneNumber = async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.validated;

    // Check attempts
    const tokenResult = await query(
      'SELECT attempts FROM phone_verification_tokens WHERE user_id = $1 AND verified = false AND expires_at > CURRENT_TIMESTAMP LIMIT 1',
      [userId]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({
        error: 'No active verification token found',
        code: 'NO_TOKEN',
      });
    }

    if (tokenResult.rows[0].attempts >= 3) {
      return res.status(429).json({
        error: 'Too many verification attempts. Please request a new code.',
        code: 'TOO_MANY_ATTEMPTS',
      });
    }

    try {
      const phoneNumber = await verifyPhoneToken(userId, token);

      res.status(200).json({
        message: 'Phone number verified successfully',
        phone_number: phoneNumber,
      });
    } catch (err) {
      await incrementVerificationAttempts(userId);

      res.status(400).json({
        error: 'Invalid or expired verification code',
        code: 'INVALID_TOKEN',
      });
    }
  } catch (err) {
    console.error('Verify phone number error:', err);
    res.status(500).json({
      error: 'Failed to verify phone number',
      code: 'VERIFY_ERROR',
    });
  }
};

/**
 * Get notification delivery logs
 */
export const getNotificationLogs = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0, channel = null } = req.query;

    let sql = `SELECT * FROM notification_delivery_logs WHERE user_id = $1`;
    const params = [userId];
    let paramCount = 2;

    if (channel) {
      sql += ` AND channel = $${paramCount}`;
      params.push(channel);
      paramCount++;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await getDeliveryLogs(userId, parseInt(limit), parseInt(offset));

    res.status(200).json(result);
  } catch (err) {
    console.error('Get notification logs error:', err);
    res.status(500).json({
      error: 'Failed to get notification logs',
      code: 'GET_ERROR',
    });
  }
};

/**
 * Get delivery statistics
 */
export const getDeliveryStatistics = async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await getDeliveryStats(userId);

    res.status(200).json({
      stats,
    });
  } catch (err) {
    console.error('Get delivery statistics error:', err);
    res.status(500).json({
      error: 'Failed to get delivery statistics',
      code: 'GET_ERROR',
    });
  }
};

/**
 * Remove phone number
 */
export const removePhoneNumber = async (req, res) => {
  try {
    const userId = req.user.id;

    await query(
      `UPDATE user_notification_preferences
       SET phone_number = NULL, phone_verified = false, sms_notifications = false, whatsapp_notifications = false
       WHERE user_id = $1`,
      [userId]
    );

    res.status(200).json({
      message: 'Phone number removed successfully',
    });
  } catch (err) {
    console.error('Remove phone number error:', err);
    res.status(500).json({
      error: 'Failed to remove phone number',
      code: 'DELETE_ERROR',
    });
  }
};

export default {
  getPreferences,
  updatePreferences,
  startPhoneVerification,
  verifyPhoneNumber,
  getNotificationLogs,
  getDeliveryStatistics,
  removePhoneNumber,
};
