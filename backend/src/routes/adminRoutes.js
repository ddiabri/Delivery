import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/authMiddleware.js';
import {
  getDashboardStats,
  getAllUsers,
  getAllDeliveries,
  getDriverAnalytics,
  getReviewsForModeration,
  getDeliveryStats,
  deactivateUser,
  cancelDelivery,
} from '../controllers/adminController.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(authorizeRole('admin'));

/**
 * GET /api/admin/dashboard
 * Get dashboard statistics
 */
router.get('/dashboard', getDashboardStats);

/**
 * GET /api/admin/users
 * Get all users with pagination and filtering
 */
router.get('/users', getAllUsers);

/**
 * GET /api/admin/deliveries
 * Get all deliveries with filtering and pagination
 */
router.get('/deliveries', getAllDeliveries);

/**
 * GET /api/admin/drivers/analytics
 * Get driver performance analytics
 */
router.get('/drivers/analytics', getDriverAnalytics);

/**
 * GET /api/admin/reviews/moderation
 * Get reviews for moderation
 */
router.get('/reviews/moderation', getReviewsForModeration);

/**
 * GET /api/admin/stats/deliveries
 * Get delivery statistics by date
 */
router.get('/stats/deliveries', getDeliveryStats);

/**
 * PUT /api/admin/users/:userId/deactivate
 * Deactivate user account
 */
router.put('/users/:userId/deactivate', deactivateUser);

/**
 * PUT /api/admin/deliveries/:deliveryId/cancel
 * Cancel delivery
 */
router.put('/deliveries/:deliveryId/cancel', cancelDelivery);

export default router;
