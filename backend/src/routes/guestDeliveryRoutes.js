import express from 'express';
import {
  createGuestDelivery,
  getGuestDelivery,
  cancelGuestDelivery,
} from '../controllers/guestDeliveryController.js';

const router = express.Router();

/**
 * Create a delivery request as a guest (no authentication required)
 * POST /api/guest/deliveries
 * Body: {
 *   pickup_address, pickup_latitude, pickup_longitude,
 *   delivery_address, delivery_latitude, delivery_longitude,
 *   package_description, package_weight, priority,
 *   special_instructions, guest_name, guest_email, guest_phone
 * }
 */
router.post('/deliveries', createGuestDelivery);

/**
 * Get guest delivery details
 * GET /api/guest/deliveries/:deliveryId?token=GUEST_TOKEN
 */
router.get('/deliveries/:deliveryId', getGuestDelivery);

/**
 * Cancel guest delivery
 * POST /api/guest/deliveries/:deliveryId/cancel
 * Body: { token: GUEST_TOKEN }
 */
router.post('/deliveries/:deliveryId/cancel', cancelGuestDelivery);

export default router;
