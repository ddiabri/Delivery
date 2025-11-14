import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  createScheduledDelivery,
  getScheduledDeliveries,
  getScheduledDeliveryById,
  updateScheduledDelivery,
  cancelScheduledDelivery,
  getUpcomingScheduledDeliveries,
  convertScheduledDelivery,
} from '../controllers/deliverySchedulingController.js';

const router = express.Router();

// User routes (protected)
router.post('/', authenticate, createScheduledDelivery);
router.get('/', authenticate, getScheduledDeliveries);
router.get('/:id', authenticate, getScheduledDeliveryById);
router.put('/:id', authenticate, updateScheduledDelivery);
router.delete('/:id', authenticate, cancelScheduledDelivery);

// Admin routes
router.get('/admin/upcoming', authenticate, getUpcomingScheduledDeliveries);
router.post('/:id/convert', authenticate, convertScheduledDelivery);

export default router;
