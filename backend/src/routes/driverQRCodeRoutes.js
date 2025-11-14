import express from 'express';
import {
  getDriverQRCode,
  verifyDriverQRCode,
  getDriverProfile,
} from '../controllers/driverQRCodeController.js';

const router = express.Router();

/**
 * Get driver QR code for their profile
 * GET /api/driver-qr-code/:driverId?format=png|svg
 */
router.get('/:driverId', getDriverQRCode);

/**
 * Verify driver from scanned QR code
 * POST /api/driver-qr-code/verify
 * Body: { qrData: string }
 */
router.post('/verify', verifyDriverQRCode);

/**
 * Get detailed driver profile
 * GET /api/driver-qr-code/:driverId/profile
 */
router.get('/:driverId/profile', getDriverProfile);

export default router;
