import nodemailer from 'nodemailer';
import { query } from '../config/database.js';

// Initialize email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true' || false,
  auth: {
    user: process.env.SMTP_USER || 'noreply@deliveryapp.com',
    pass: process.env.SMTP_PASSWORD || 'default_password',
  },
});

const senderEmail = process.env.SENDER_EMAIL || 'noreply@deliveryapp.com';
const senderName = process.env.SENDER_NAME || 'Delivery App';

/**
 * Send email notification
 */
export const sendEmail = async (userId, recipientEmail, subject, htmlContent, messageType = 'TRANSACTIONAL') => {
  try {
    const mailOptions = {
      from: `${senderName} <${senderEmail}>`,
      to: recipientEmail,
      subject,
      html: htmlContent,
    };

    const result = await transporter.sendMail(mailOptions);

    // Log delivery attempt
    await logEmailDelivery(userId, recipientEmail, subject, 'SENT', messageType, htmlContent, null, result.messageId);

    console.log(`[Email] Message sent to ${recipientEmail}: ${result.messageId}`);
    return result;
  } catch (err) {
    console.error('Error sending email:', err);
    await logEmailDelivery(userId, recipientEmail, subject, 'FAILED', messageType, htmlContent, err.message);
    throw err;
  }
};

/**
 * Send delivery status email template
 */
export const sendDeliveryStatusEmail = async (userId, recipientEmail, status, deliveryDetails) => {
  try {
    const statusEmojis = {
      PENDING: '⏳',
      ACCEPTED: '✅',
      PICKED_UP: '📦',
      IN_TRANSIT: '🚗',
      DELIVERED: '🎉',
      CANCELLED: '❌',
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 8px; }
          .header { background-color: #667eea; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { padding: 20px; background-color: white; border-radius: 0 0 8px 8px; }
          .status-badge { display: inline-block; padding: 10px 20px; background-color: #667eea; color: white; border-radius: 4px; font-weight: bold; }
          .details { margin-top: 20px; padding: 15px; background-color: #f5f5f5; border-left: 4px solid #667eea; }
          .detail-row { margin: 8px 0; }
          .detail-label { font-weight: bold; color: #667eea; }
          .footer { text-align: center; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚚 Delivery Update</h1>
          </div>
          <div class="content">
            <p>Hi ${deliveryDetails.customerName},</p>
            <p>Your delivery status has been updated:</p>

            <div class="status-badge">${statusEmojis[status] || ''} ${status.replace(/_/g, ' ')}</div>

            <div class="details">
              <div class="detail-row">
                <span class="detail-label">Pickup:</span>
                ${deliveryDetails.pickupAddress}
              </div>
              <div class="detail-row">
                <span class="detail-label">Delivery:</span>
                ${deliveryDetails.deliveryAddress}
              </div>
              ${deliveryDetails.driverName ? `
              <div class="detail-row">
                <span class="detail-label">Driver:</span>
                ${deliveryDetails.driverName}
              </div>
              ` : ''}
              ${deliveryDetails.estimatedTime ? `
              <div class="detail-row">
                <span class="detail-label">Estimated Delivery:</span>
                ${deliveryDetails.estimatedTime}
              </div>
              ` : ''}
            </div>

            <p style="margin-top: 20px;">Thank you for using our delivery service!</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 Delivery App. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmail(userId, recipientEmail, `Delivery Update: ${status}`, htmlContent, 'DELIVERY_STATUS');
  } catch (err) {
    console.error('Error sending delivery status email:', err);
    throw err;
  }
};

/**
 * Send points earned email template
 */
export const sendPointsEarnedEmail = async (userId, recipientEmail, userName, pointsEarned, reason) => {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 8px; }
          .header { background-color: #667eea; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { padding: 20px; background-color: white; border-radius: 0 0 8px 8px; }
          .points-badge { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border-radius: 8px; font-weight: bold; font-size: 24px; text-align: center; }
          .reason { margin-top: 15px; padding: 10px; background-color: #f5f5f5; border-left: 4px solid #667eea; }
          .footer { text-align: center; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⭐ Points Earned!</h1>
          </div>
          <div class="content">
            <p>Hi ${userName},</p>
            <p>Great news! You've earned points:</p>

            <div style="text-align: center; margin: 20px 0;">
              <div class="points-badge">+ ${pointsEarned} PTS</div>
            </div>

            ${reason ? `
            <div class="reason">
              <strong>Reason:</strong> ${reason}
            </div>
            ` : ''}

            <p style="margin-top: 20px;">Keep using our service to earn more points and unlock rewards!</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 Delivery App. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmail(userId, recipientEmail, `You've earned ${pointsEarned} points!`, htmlContent, 'POINTS_EARNED');
  } catch (err) {
    console.error('Error sending points earned email:', err);
    throw err;
  }
};

/**
 * Send promotional email template
 */
export const sendPromotionalEmail = async (userId, recipientEmail, userName, title, description, campaignLink) => {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 8px; }
          .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { padding: 20px; background-color: white; border-radius: 0 0 8px 8px; }
          .promo-box { margin-top: 20px; padding: 20px; background-color: #f5f1ff; border: 2px solid #667eea; border-radius: 8px; text-align: center; }
          .cta-button { display: inline-block; padding: 12px 30px; background-color: #667eea; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 15px; }
          .footer { text-align: center; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Special Offer for You!</h1>
          </div>
          <div class="content">
            <p>Hi ${userName},</p>

            <div class="promo-box">
              <h2>${title}</h2>
              <p>${description}</p>
              <a href="${campaignLink}" class="cta-button">View Offer</a>
            </div>

            <p style="margin-top: 20px; font-size: 12px; color: #999;">This is a promotional offer. Visit the app to view details.</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 Delivery App. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmail(userId, recipientEmail, title, htmlContent, 'PROMOTIONAL');
  } catch (err) {
    console.error('Error sending promotional email:', err);
    throw err;
  }
};

/**
 * Log email delivery attempt
 */
export const logEmailDelivery = async (userId, recipientEmail, subject, status, messageType, messageContent, errorMessage = null, externalId = null) => {
  try {
    await query(
      `INSERT INTO notification_delivery_logs (
        user_id, channel, status, message_type,
        recipient, message_content, error_message, external_id, sent_at
      )
      VALUES ($1, 'EMAIL', $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
      [userId, status, messageType, recipientEmail, messageContent, errorMessage, externalId]
    );
  } catch (err) {
    console.error('Error logging email delivery:', err);
  }
};

/**
 * Send bulk emails
 */
export const sendBulkEmails = async (recipients, subject, htmlContent) => {
  try {
    const results = [];

    for (const recipient of recipients) {
      try {
        const result = await transporter.sendMail({
          from: `${senderName} <${senderEmail}>`,
          to: recipient.email,
          subject,
          html: htmlContent,
        });

        results.push({ email: recipient.email, status: 'SENT', messageId: result.messageId });
        await logEmailDelivery(recipient.userId, recipient.email, subject, 'SENT', 'BULK', htmlContent, null, result.messageId);
      } catch (err) {
        console.error(`Error sending email to ${recipient.email}:`, err);
        results.push({ email: recipient.email, status: 'FAILED', error: err.message });
        await logEmailDelivery(recipient.userId, recipient.email, subject, 'FAILED', 'BULK', htmlContent, err.message);
      }
    }

    return results;
  } catch (err) {
    console.error('Error in bulk email sending:', err);
    throw err;
  }
};
