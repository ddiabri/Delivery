import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  createBulkMessage,
  getBulkMessages,
  getBulkMessageById,
  sendBulkMessage,
  queueBulkMessage,
  cancelBulkMessage,
  getBulkMessageStats,
} from '../controllers/bulkMessagingController.js';

const router = express.Router();

// Admin routes
router.post('/', authenticate, createBulkMessage);
router.get('/', authenticate, getBulkMessages);
router.get('/:id', authenticate, getBulkMessageById);
router.post('/:id/send', authenticate, sendBulkMessage);
router.post('/:id/queue', authenticate, queueBulkMessage);
router.post('/:id/cancel', authenticate, cancelBulkMessage);
router.get('/:id/stats', authenticate, getBulkMessageStats);

export default router;
