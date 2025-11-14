import express from 'express';
import {
  getPreferences,
  updatePreferences,
  startPhoneVerification,
  verifyPhoneNumber,
  getNotificationLogs,
  getDeliveryStatistics,
  removePhoneNumber,
} from '../controllers/notificationPreferencesController.js';

const router = express.Router();

/**
 * Get user notification preferences
 * GET /api/notification-preferences
 */
router.get('/', getPreferences);

/**
 * Update notification preferences
 * PUT /api/notification-preferences
 */
router.put('/', updatePreferences);

/**
 * Start phone number verification
 * POST /api/notification-preferences/verify-phone/start
 */
router.post('/verify-phone/start', startPhoneVerification);

/**
 * Verify phone number with token
 * POST /api/notification-preferences/verify-phone/confirm
 */
router.post('/verify-phone/confirm', verifyPhoneNumber);

/**
 * Remove phone number
 * DELETE /api/notification-preferences/phone
 */
router.delete('/phone', removePhoneNumber);

/**
 * Get notification delivery logs
 * GET /api/notification-preferences/logs?limit=50&offset=0&channel=SMS
 */
router.get('/logs', getNotificationLogs);

/**
 * Get delivery statistics
 * GET /api/notification-preferences/stats
 */
router.get('/stats', getDeliveryStatistics);

export default router;
