import twilio from 'twilio';
import { query } from '../config/database.js';

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID || 'AC_TEST';
const authToken = process.env.TWILIO_AUTH_TOKEN || 'test_token';
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER || '+1234567890';
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+1234567890';

const client = accountSid !== 'AC_TEST' ? twilio(accountSid, authToken) : null;

/**
 * Send SMS notification
 */
export const sendSMS = async (userId, phoneNumber, message, messageType) => {
  try {
    if (!client) {
      console.log('[Twilio] SMS disabled - not configured');
      return logDeliveryAttempt(userId, null, 'SMS', 'FAILED', messageType, phoneNumber, message, 'Twilio not configured');
    }

    const result = await client.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: phoneNumber,
    });

    // Log successful send
    await logDeliveryAttempt(userId, null, 'SMS', 'SENT', messageType, phoneNumber, message, null, result.sid);

    console.log(`[SMS] Message sent to ${phoneNumber}: ${result.sid}`);
    return result;
  } catch (err) {
    console.error('Error sending SMS:', err);
    await logDeliveryAttempt(userId, null, 'SMS', 'FAILED', messageType, phoneNumber, message, err.message);
    throw err;
  }
};

/**
 * Send WhatsApp notification
 */
export const sendWhatsApp = async (userId, phoneNumber, message, messageType) => {
  try {
    if (!client) {
      console.log('[Twilio] WhatsApp disabled - not configured');
      return logDeliveryAttempt(userId, null, 'WHATSAPP', 'FAILED', messageType, `whatsapp:${phoneNumber}`, message, 'Twilio not configured');
    }

    const result = await client.messages.create({
      body: message,
      from: twilioWhatsAppNumber,
      to: `whatsapp:${phoneNumber}`,
    });

    // Log successful send
    await logDeliveryAttempt(userId, null, 'WHATSAPP', 'SENT', messageType, phoneNumber, message, null, result.sid);

    console.log(`[WhatsApp] Message sent to ${phoneNumber}: ${result.sid}`);
    return result;
  } catch (err) {
    console.error('Error sending WhatsApp:', err);
    await logDeliveryAttempt(userId, null, 'WHATSAPP', 'FAILED', messageType, phoneNumber, message, err.message);
    throw err;
  }
};

/**
 * Send SMS with media
 */
export const sendSMSWithMedia = async (userId, phoneNumber, message, mediaUrl, messageType) => {
  try {
    if (!client) {
      console.log('[Twilio] SMS with media disabled - not configured');
      return null;
    }

    const result = await client.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: phoneNumber,
      mediaUrl: [mediaUrl],
    });

    await logDeliveryAttempt(userId, null, 'SMS', 'SENT', messageType, phoneNumber, message, null, result.sid);
    return result;
  } catch (err) {
    console.error('Error sending SMS with media:', err);
    await logDeliveryAttempt(userId, null, 'SMS', 'FAILED', messageType, phoneNumber, message, err.message);
    throw err;
  }
};

/**
 * Send WhatsApp with media
 */
export const sendWhatsAppWithMedia = async (userId, phoneNumber, message, mediaUrl, messageType) => {
  try {
    if (!client) {
      console.log('[Twilio] WhatsApp with media disabled - not configured');
      return null;
    }

    const result = await client.messages.create({
      body: message,
      from: twilioWhatsAppNumber,
      to: `whatsapp:${phoneNumber}`,
      mediaUrl: [mediaUrl],
    });

    await logDeliveryAttempt(userId, null, 'WHATSAPP', 'SENT', messageType, phoneNumber, message, null, result.sid);
    return result;
  } catch (err) {
    console.error('Error sending WhatsApp with media:', err);
    await logDeliveryAttempt(userId, null, 'WHATSAPP', 'FAILED', messageType, phoneNumber, message, err.message);
    throw err;
  }
};

/**
 * Log notification delivery attempt
 */
export const logDeliveryAttempt = async (userId, notificationId, channel, status, messageType, recipient, messageContent, errorMessage = null, externalId = null) => {
  try {
    await query(
      `INSERT INTO notification_delivery_logs (
        user_id, notification_id, channel, status, message_type,
        recipient, message_content, error_message, external_id, sent_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)`,
      [
        userId,
        notificationId,
        channel,
        status,
        messageType,
        recipient,
        messageContent,
        errorMessage,
        externalId,
      ]
    );
  } catch (err) {
    console.error('Error logging delivery attempt:', err);
  }
};

/**
 * Get delivery logs for user
 */
export const getDeliveryLogs = async (userId, limit = 50, offset = 0) => {
  try {
    const result = await query(
      `SELECT * FROM notification_delivery_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM notification_delivery_logs WHERE user_id = $1`,
      [userId]
    );

    return {
      logs: result.rows,
      total: parseInt(countResult.rows[0].total),
      hasMore: offset + limit < parseInt(countResult.rows[0].total),
    };
  } catch (err) {
    console.error('Error getting delivery logs:', err);
    throw err;
  }
};

/**
 * Get delivery stats for user
 */
export const getDeliveryStats = async (userId) => {
  try {
    const result = await query(
      `SELECT channel, status, COUNT(*) as count
       FROM notification_delivery_logs
       WHERE user_id = $1
       GROUP BY channel, status`,
      [userId]
    );

    const stats = {
      SMS: { sent: 0, failed: 0, delivered: 0 },
      WHATSAPP: { sent: 0, failed: 0, delivered: 0 },
      EMAIL: { sent: 0, failed: 0, delivered: 0 },
      IN_APP: { sent: 0, failed: 0, delivered: 0 },
      BROWSER: { sent: 0, failed: 0, delivered: 0 },
    };

    result.rows.forEach((row) => {
      if (stats[row.channel]) {
        stats[row.channel][row.status.toLowerCase()] = parseInt(row.count);
      }
    });

    return stats;
  } catch (err) {
    console.error('Error getting delivery stats:', err);
    throw err;
  }
};

/**
 * Generate verification token for phone number
 */
export const generatePhoneVerificationToken = async (userId, phoneNumber) => {
  try {
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await query(
      `INSERT INTO phone_verification_tokens (user_id, phone_number, token, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, phoneNumber, token, expiresAt]
    );

    return token;
  } catch (err) {
    console.error('Error generating verification token:', err);
    throw err;
  }
};

/**
 * Verify phone number with token
 */
export const verifyPhoneToken = async (userId, token) => {
  try {
    const result = await query(
      `SELECT phone_number FROM phone_verification_tokens
       WHERE user_id = $1 AND token = $2 AND expires_at > CURRENT_TIMESTAMP AND verified = false`,
      [userId, token]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid or expired token');
    }

    const phoneNumber = result.rows[0].phone_number;

    // Mark as verified
    await query(
      `UPDATE phone_verification_tokens SET verified = true WHERE user_id = $1 AND token = $2`,
      [userId, token]
    );

    // Update user preferences
    await query(
      `UPDATE user_notification_preferences
       SET phone_number = $2, phone_verified = true, phone_verified_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId, phoneNumber]
    );

    return phoneNumber;
  } catch (err) {
    console.error('Error verifying phone token:', err);
    throw err;
  }
};

/**
 * Send verification SMS
 */
export const sendVerificationSMS = async (phoneNumber, token) => {
  try {
    if (!client) {
      console.log('[Twilio] Verification SMS disabled - not configured');
      return null;
    }

    const message = `Your Delivery App verification code is: ${token}. This code expires in 10 minutes.`;

    const result = await client.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: phoneNumber,
    });

    console.log(`[SMS] Verification code sent to ${phoneNumber}: ${result.sid}`);
    return result;
  } catch (err) {
    console.error('Error sending verification SMS:', err);
    throw err;
  }
};

/**
 * Increment phone verification attempts
 */
export const incrementVerificationAttempts = async (userId) => {
  try {
    await query(
      `UPDATE phone_verification_tokens SET attempts = attempts + 1
       WHERE user_id = $1 AND verified = false AND expires_at > CURRENT_TIMESTAMP
       LIMIT 1`,
      [userId]
    );
  } catch (err) {
    console.error('Error incrementing attempts:', err);
  }
};
