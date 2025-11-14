/**
 * Driver Wallet Pass Routes
 * Routes for Apple Wallet and Google Wallet pass generation
 */

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getAppleWalletPass,
  getGoogleWalletPass,
  getWalletPassConfig,
  validateWalletPassGeneration,
  trackWalletPassAddition,
} from '../controllers/driverWalletPassController.js';

const router = express.Router();

/**
 * Public routes (no authentication required for wallet pass download)
 * Drivers can share these links publicly
 */

// Get Apple Wallet pass (.pkpass file)
router.get('/apple/:driverId', getAppleWalletPass);

// Get Google Wallet pass (JWT + redirect URL)
router.get('/google/:driverId', getGoogleWalletPass);

// Get wallet pass configuration status
router.get('/config', getWalletPassConfig);

// Validate wallet pass generation for a driver
router.get('/validate/:driverId', validateWalletPassGeneration);

/**
 * Protected routes (authentication required)
 */

// Track wallet pass additions for analytics
router.post('/track', authenticate, trackWalletPassAddition);

export default router;
