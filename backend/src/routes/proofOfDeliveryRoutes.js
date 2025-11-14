import express from 'express';
import {
  uploadProofOfDelivery,
  getProofOfDelivery,
  verifyProofOfDelivery,
  rejectProofOfDelivery
} from '../controllers/proofOfDeliveryController.js';

const router = express.Router();

/**
 * Upload proof of delivery for a delivery
 * POST /api/pod/:deliveryId/upload
 */
router.post('/:deliveryId/upload', uploadProofOfDelivery);

/**
 * Get proof of delivery
 * GET /api/pod/:deliveryId
 */
router.get('/:deliveryId', getProofOfDelivery);

/**
 * Verify proof of delivery (admin or customer)
 * PUT /api/pod/:deliveryId/verify
 */
router.put('/:deliveryId/verify', verifyProofOfDelivery);

/**
 * Reject proof of delivery (admin only)
 * PUT /api/pod/:deliveryId/reject
 */
router.put('/:deliveryId/reject', rejectProofOfDelivery);

export default router;
