import { query } from '../config/database.js';
import { sendSMS, sendWhatsApp } from '../utils/twilioService.js';
import { sendEmail, sendBulkEmails } from '../utils/emailService.js';

/**
 * Create a bulk message campaign
 */
export const createBulkMessage = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const {
      campaign_id,
      message_type,
      target_user_type,
      target_user_ids,
      message_subject,
      message_template,
      scheduled_send_time,
    } = req.body;

    if (!message_type || !target_user_type || !message_template) {
      return res.status(400).json({ error: 'Required fields: message_type, target_user_type, message_template' });
    }

    // Get total recipients count
    let recipientCount = 0;
    if (target_user_type === 'CUSTOM' && target_user_ids && target_user_ids.length > 0) {
      recipientCount = target_user_ids.length;
    } else {
      const countResult = await query(
        `SELECT COUNT(*) as count FROM users
         WHERE role = CASE
           WHEN $1 = 'CUSTOMER' THEN 'customer'
           WHEN $1 = 'DRIVER' THEN 'driver'
           ELSE role
         END`,
        [target_user_type]
      );
      recipientCount = parseInt(countResult.rows[0].count);
    }

    const result = await query(
      `INSERT INTO bulk_messages (
        campaign_id, created_by, message_type, target_user_type,
        target_user_ids, status, message_subject, message_template,
        total_recipients, scheduled_send_time
      )
      VALUES ($1, $2, $3, $4, $5, 'DRAFT', $6, $7, $8, $9)
      RETURNING *`,
      [
        campaign_id || null,
        req.user.id,
        message_type,
        target_user_type,
        JSON.stringify(target_user_ids || []),
        message_subject || null,
        message_template,
        recipientCount,
        scheduled_send_time || null,
      ]
    );

    res.status(201).json({
      message: 'Bulk message created successfully',
      bulkMessage: result.rows[0],
    });
  } catch (err) {
    console.error('Error creating bulk message:', err);
    res.status(500).json({ error: 'Failed to create bulk message' });
  }
};

/**
 * Get bulk messages (admin only)
 */
export const getBulkMessages = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { status, limit = 50, offset = 0 } = req.query;

    let whereClause = '';
    const params = [];

    if (status) {
      whereClause = 'WHERE status = $1';
      params.push(status);
    }

    const result = await query(
      `SELECT
        bm.*,
        u.full_name as created_by_name
       FROM bulk_messages bm
       JOIN users u ON bm.created_by = u.id
       ${whereClause}
       ORDER BY bm.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM bulk_messages ${whereClause}`,
      params
    );

    res.json({
      bulkMessages: result.rows,
      total: parseInt(countResult.rows[0].total),
      hasMore: offset + limit < parseInt(countResult.rows[0].total),
    });
  } catch (err) {
    console.error('Error fetching bulk messages:', err);
    res.status(500).json({ error: 'Failed to fetch bulk messages' });
  }
};

/**
 * Get a specific bulk message
 */
export const getBulkMessageById = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    const result = await query(
      `SELECT * FROM bulk_messages WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bulk message not found' });
    }

    res.json({ bulkMessage: result.rows[0] });
  } catch (err) {
    console.error('Error fetching bulk message:', err);
    res.status(500).json({ error: 'Failed to fetch bulk message' });
  }
};

/**
 * Send a bulk message campaign
 */
export const sendBulkMessage = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    // Get bulk message
    const msgResult = await query(
      `SELECT * FROM bulk_messages WHERE id = $1`,
      [id]
    );

    if (msgResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bulk message not found' });
    }

    const bulkMessage = msgResult.rows[0];

    if (bulkMessage.status !== 'DRAFT' && bulkMessage.status !== 'QUEUED') {
      return res.status(400).json({ error: 'Message can only be sent from DRAFT or QUEUED status' });
    }

    // Mark as sending
    await query(
      `UPDATE bulk_messages SET status = 'SENDING', started_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );

    // Get target users
    let users = [];
    if (bulkMessage.target_user_type === 'CUSTOM') {
      const userIds = bulkMessage.target_user_ids || [];
      if (userIds.length > 0) {
        const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',');
        const userResult = await query(
          `SELECT id, email, full_name FROM users WHERE id IN (${placeholders})`,
          userIds
        );
        users = userResult.rows;
      }
    } else {
      let roleFilter = '';
      if (bulkMessage.target_user_type === 'CUSTOMER') {
        roleFilter = "WHERE role = 'customer'";
      } else if (bulkMessage.target_user_type === 'DRIVER') {
        roleFilter = "WHERE role = 'driver'";
      }

      const userResult = await query(
        `SELECT id, email, full_name FROM users ${roleFilter}`,
        []
      );
      users = userResult.rows;
    }

    // Send messages based on type
    let sentCount = 0;
    let failedCount = 0;

    if (bulkMessage.message_type === 'EMAIL') {
      // Send emails
      const recipients = users.map((u) => ({
        userId: u.id,
        email: u.email,
        name: u.full_name,
      }));

      try {
        const results = await sendBulkEmails(
          recipients,
          bulkMessage.message_subject,
          bulkMessage.message_template
        );

        sentCount = results.filter((r) => r.status === 'SENT').length;
        failedCount = results.filter((r) => r.status === 'FAILED').length;
      } catch (err) {
        console.error('Error sending bulk emails:', err);
        failedCount = users.length;
      }
    } else if (bulkMessage.message_type === 'SMS') {
      // Send SMS
      const userPrefsResult = await query(
        `SELECT user_id, phone_number FROM user_notification_preferences
         WHERE user_id = ANY($1::uuid[]) AND phone_verified = true AND sms_notifications = true`,
        [users.map((u) => u.id)]
      );

      const userPhones = new Map();
      userPrefsResult.rows.forEach((row) => {
        userPhones.set(row.user_id, row.phone_number);
      });

      for (const user of users) {
        if (userPhones.has(user.id)) {
          try {
            await sendSMS(user.id, userPhones.get(user.id), bulkMessage.message_template, 'BULK_SMS');
            sentCount++;
          } catch (err) {
            console.error(`Error sending SMS to ${user.id}:`, err);
            failedCount++;
          }
        } else {
          failedCount++;
        }
      }
    } else if (bulkMessage.message_type === 'WHATSAPP') {
      // Send WhatsApp
      const userPrefsResult = await query(
        `SELECT user_id, phone_number FROM user_notification_preferences
         WHERE user_id = ANY($1::uuid[]) AND phone_verified = true AND whatsapp_notifications = true`,
        [users.map((u) => u.id)]
      );

      const userPhones = new Map();
      userPrefsResult.rows.forEach((row) => {
        userPhones.set(row.user_id, row.phone_number);
      });

      for (const user of users) {
        if (userPhones.has(user.id)) {
          try {
            await sendWhatsApp(user.id, userPhones.get(user.id), bulkMessage.message_template, 'BULK_WHATSAPP');
            sentCount++;
          } catch (err) {
            console.error(`Error sending WhatsApp to ${user.id}:`, err);
            failedCount++;
          }
        } else {
          failedCount++;
        }
      }
    }

    // Update bulk message with results
    const updateResult = await query(
      `UPDATE bulk_messages
       SET status = 'COMPLETED', sent_count = $2, failed_count = $3, completed_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, sentCount, failedCount]
    );

    res.json({
      message: 'Bulk message sent successfully',
      bulkMessage: updateResult.rows[0],
      statistics: {
        sent: sentCount,
        failed: failedCount,
        total: sentCount + failedCount,
      },
    });
  } catch (err) {
    console.error('Error sending bulk message:', err);

    // Mark as failed
    await query(
      `UPDATE bulk_messages SET status = 'FAILED' WHERE id = $1`,
      [req.params.id]
    );

    res.status(500).json({ error: 'Failed to send bulk message' });
  }
};

/**
 * Queue a bulk message for later sending
 */
export const queueBulkMessage = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    const result = await query(
      `UPDATE bulk_messages
       SET status = 'QUEUED'
       WHERE id = $1 AND status = 'DRAFT'
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bulk message not found or not in DRAFT status' });
    }

    res.json({
      message: 'Bulk message queued successfully',
      bulkMessage: result.rows[0],
    });
  } catch (err) {
    console.error('Error queuing bulk message:', err);
    res.status(500).json({ error: 'Failed to queue bulk message' });
  }
};

/**
 * Cancel a bulk message
 */
export const cancelBulkMessage = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    const result = await query(
      `UPDATE bulk_messages
       SET status = 'CANCELLED'
       WHERE id = $1 AND status IN ('DRAFT', 'QUEUED')
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bulk message not found or cannot be cancelled' });
    }

    res.json({
      message: 'Bulk message cancelled',
      bulkMessage: result.rows[0],
    });
  } catch (err) {
    console.error('Error cancelling bulk message:', err);
    res.status(500).json({ error: 'Failed to cancel bulk message' });
  }
};

/**
 * Get bulk message statistics
 */
export const getBulkMessageStats = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    const result = await query(
      `SELECT
        id, total_recipients, sent_count, failed_count, bounced_count,
        status, created_at, started_at, completed_at,
        ROUND((sent_count::float / NULLIF(total_recipients, 0)) * 100, 2) as success_rate
       FROM bulk_messages
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bulk message not found' });
    }

    res.json({ stats: result.rows[0] });
  } catch (err) {
    console.error('Error fetching bulk message stats:', err);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};
