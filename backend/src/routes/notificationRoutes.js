import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { pool } from '../config/database.js';

const router = express.Router();
router.use(authenticateToken);

// Get user notifications
router.get('/', async (req, res) => {
  const userId = req.user.id;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = parseInt(req.query.offset) || 0;

  try {
    const result = await pool.query(
      `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.put('/:notificationId/read', async (req, res) => {
  const { notificationId } = req.params;
  const userId = req.user.id;

  try {
    await pool.query(
      `UPDATE notifications SET is_read = true
       WHERE id = $1 AND user_id = $2`,
      [notificationId, userId]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Get unread count
router.get('/count/unread', async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM notifications
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    res.json({
      success: true,
      data: { unread_count: parseInt(result.rows[0].count) },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

export default router;
