import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { validateMiddleware } from '../utils/validation.js';
import { messageSchemas } from '../utils/validation.js';
import {
  sendMessage,
  getChatHistory,
  getUnreadCount,
  markMessagesAsRead,
} from '../controllers/chatController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * POST /api/messages
 * Send a message
 */
router.post('/', validateMiddleware(messageSchemas.send), sendMessage);

/**
 * GET /api/messages/:deliveryId
 * Get chat history for a delivery
 */
router.get('/:deliveryId', getChatHistory);

/**
 * GET /api/messages/:deliveryId/unread
 * Get unread message count
 */
router.get('/:deliveryId/unread', getUnreadCount);

/**
 * PUT /api/messages/:deliveryId/mark-read
 * Mark all messages as read
 */
router.put('/:deliveryId/mark-read', markMessagesAsRead);

export default router;
