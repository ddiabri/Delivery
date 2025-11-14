import express from 'express';
import {
  createDelivery,
  getDeliveries,
  getDeliveryById,
  updateDeliveryStatus,
} from '../controllers/deliveryController.js';
import { authenticateToken, authorizeRole } from '../middleware/authMiddleware.js';
import { validateMiddleware, deliverySchemas } from '../utils/validation.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/deliveries
 * @desc    Create a new delivery request
 * @access  Private (Customer)
 */
router.post(
  '/',
  authorizeRole('customer'),
  validateMiddleware(deliverySchemas.create),
  createDelivery
);

/**
 * @route   GET /api/deliveries
 * @desc    Get deliveries (filtered by role)
 * @access  Private
 */
router.get('/', validateMiddleware(deliverySchemas.search), getDeliveries);

/**
 * @route   GET /api/deliveries/:id
 * @desc    Get specific delivery
 * @access  Private
 */
router.get('/:id', getDeliveryById);

/**
 * @route   PUT /api/deliveries/:id/status
 * @desc    Update delivery status
 * @access  Private
 */
router.put(
  '/:id/status',
  validateMiddleware(deliverySchemas.updateStatus),
  updateDeliveryStatus
);

export default router;
