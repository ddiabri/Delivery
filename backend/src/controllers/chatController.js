import { pool } from '../config/database.js';

/**
 * Send a message
 */
export const sendMessage = async (req, res) => {
  const { deliveryId, recipientId, message_text } = req.body;
  const senderId = req.user.id;

  try {
    // Verify delivery exists and user is involved
    const deliveryResult = await pool.query(
      `SELECT id, customer_id, driver_id FROM deliveries WHERE id = $1`,
      [deliveryId]
    );

    if (deliveryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    const delivery = deliveryResult.rows[0];

    // Verify sender and recipient are involved in the delivery
    const isValidParticipant =
      (senderId === delivery.customer_id || senderId === delivery.driver_id) &&
      (recipientId === delivery.customer_id || recipientId === delivery.driver_id) &&
      senderId !== recipientId;

    if (!isValidParticipant) {
      return res.status(403).json({ error: 'Not authorized to message in this delivery' });
    }

    // Insert message
    const messageResult = await pool.query(
      `INSERT INTO messages (delivery_id, sender_id, recipient_id, message_text)
       VALUES ($1, $2, $3, $4)
       RETURNING id, delivery_id, sender_id, recipient_id, message_text, is_read, created_at`,
      [deliveryId, senderId, recipientId, message_text]
    );

    const message = messageResult.rows[0];

    // Get sender info
    const senderResult = await pool.query(
      `SELECT id, full_name, profile_image_url FROM users WHERE id = $1`,
      [senderId]
    );

    res.status(201).json({
      success: true,
      data: {
        ...message,
        sender_name: senderResult.rows[0]?.full_name,
        sender_image: senderResult.rows[0]?.profile_image_url,
      },
    });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

/**
 * Get chat history for a delivery
 */
export const getChatHistory = async (req, res) => {
  const { deliveryId } = req.params;
  const userId = req.user.id;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const offset = parseInt(req.query.offset) || 0;

  try {
    // Verify user is involved in delivery
    const deliveryResult = await pool.query(
      `SELECT id, customer_id, driver_id FROM deliveries WHERE id = $1`,
      [deliveryId]
    );

    if (deliveryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    const delivery = deliveryResult.rows[0];
    const isInvolved = userId === delivery.customer_id || userId === delivery.driver_id;

    if (!isInvolved) {
      return res.status(403).json({ error: 'Not authorized to view this chat' });
    }

    // Get message count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM messages WHERE delivery_id = $1`,
      [deliveryId]
    );

    const total = parseInt(countResult.rows[0].total);

    // Get messages with sender and recipient info
    const messagesResult = await pool.query(
      `SELECT
         m.id, m.delivery_id, m.sender_id, m.recipient_id, m.message_text, m.is_read, m.created_at,
         sender.full_name as sender_name, sender.profile_image_url as sender_image,
         recipient.full_name as recipient_name, recipient.profile_image_url as recipient_image
       FROM messages m
       JOIN users sender ON m.sender_id = sender.id
       JOIN users recipient ON m.recipient_id = recipient.id
       WHERE m.delivery_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [deliveryId, limit, offset]
    );

    // Reverse to get chronological order
    const messages = messagesResult.rows.reverse();

    // Mark messages as read for current user
    await pool.query(
      `UPDATE messages SET is_read = true WHERE delivery_id = $1 AND recipient_id = $2 AND is_read = false`,
      [deliveryId, userId]
    );

    res.json({
      success: true,
      data: messages,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (err) {
    console.error('Get chat history error:', err);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
};

/**
 * Get unread message count
 */
export const getUnreadCount = async (req, res) => {
  const { deliveryId } = req.params;
  const userId = req.user.id;

  try {
    // Verify user is involved in delivery
    const deliveryResult = await pool.query(
      `SELECT id, customer_id, driver_id FROM deliveries WHERE id = $1`,
      [deliveryId]
    );

    if (deliveryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    const delivery = deliveryResult.rows[0];
    const isInvolved = userId === delivery.customer_id || userId === delivery.driver_id;

    if (!isInvolved) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get unread count
    const result = await pool.query(
      `SELECT COUNT(*) as unread_count FROM messages
       WHERE delivery_id = $1 AND recipient_id = $2 AND is_read = false`,
      [deliveryId, userId]
    );

    res.json({
      success: true,
      data: {
        delivery_id: deliveryId,
        unread_count: parseInt(result.rows[0].unread_count),
      },
    });
  } catch (err) {
    console.error('Get unread count error:', err);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
};

/**
 * Mark all messages as read
 */
export const markMessagesAsRead = async (req, res) => {
  const { deliveryId } = req.params;
  const userId = req.user.id;

  try {
    // Verify user is involved in delivery
    const deliveryResult = await pool.query(
      `SELECT id, customer_id, driver_id FROM deliveries WHERE id = $1`,
      [deliveryId]
    );

    if (deliveryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    const delivery = deliveryResult.rows[0];
    const isInvolved = userId === delivery.customer_id || userId === delivery.driver_id;

    if (!isInvolved) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update messages
    const result = await pool.query(
      `UPDATE messages SET is_read = true
       WHERE delivery_id = $1 AND recipient_id = $2 AND is_read = false
       RETURNING id`,
      [deliveryId, userId]
    );

    res.json({
      success: true,
      data: {
        messages_updated: result.rows.length,
      },
    });
  } catch (err) {
    console.error('Mark as read error:', err);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
};
