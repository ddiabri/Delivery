import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import {
  generateDeliveryQRCode,
  verifyQRCodePickup,
  getQRCodeInfo,
} from '../controllers/qrCodeController.js';

const router = express.Router();
router.use(authenticateToken);

/**
 * POST /api/qr-code/:deliveryId/generate
 * Generate QR code for delivery (customer only)
 */
router.post('/:deliveryId/generate', generateDeliveryQRCode);

/**
 * POST /api/qr-code/verify
 * Verify QR code and confirm pickup (driver)
 */
router.post('/verify-pickup', verifyQRCodePickup);

/**
 * GET /api/qr-code/:deliveryId/info
 * Get QR code info for delivery
 */
router.get('/:deliveryId/info', getQRCodeInfo);

export default router;
