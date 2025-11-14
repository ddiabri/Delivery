import express from 'express';
import {
  getAvailableDeliveries,
  updateDriverLocation,
  getDriverStats,
  getActiveDeliveries,
} from '../controllers/driverController.js';
import { authenticateToken, authorizeRole } from '../middleware/authMiddleware.js';
import { validateMiddleware, driverSchemas, deliverySchemas } from '../utils/validation.js';

const router = express.Router();

// All routes require authentication and driver role
router.use(authenticateToken, authorizeRole('driver'));

/**
 * @route   GET /api/drivers/available
 * @desc    Get available deliveries near driver
 * @access  Private (Driver)
 */
router.get(
  '/available',
  validateMiddleware(
    deliverySchemas.search.keys({
      latitude: require('joi').number().required(),
      longitude: require('joi').number().required(),
    })
  ),
  getAvailableDeliveries
);

/**
 * @route   GET /api/drivers/active
 * @desc    Get driver's active deliveries
 * @access  Private (Driver)
 */
router.get('/active', getActiveDeliveries);

/**
 * @route   POST /api/drivers/location
 * @desc    Update driver's current location
 * @access  Private (Driver)
 */
router.post(
  '/location',
  validateMiddleware(driverSchemas.updateLocation),
  updateDriverLocation
);

/**
 * @route   GET /api/drivers/stats
 * @desc    Get driver performance statistics
 * @access  Private (Driver)
 */
router.get('/stats', getDriverStats);

export default router;
