/**
 * Driver Wallet Pass Controller
 * Handles Apple Wallet and Google Wallet pass generation and delivery
 */

import { query } from '../config/database.js';
import {
  generateAppleWalletPass,
} from '../utils/appleWalletService.js';
import {
  generateGoogleWalletPass,
  getGoogleWalletConfig,
} from '../utils/googleWalletService.js';

/**
 * Generate and download Apple Wallet pass (.pkpass)
 * @route GET /api/driver-wallet-pass/apple/:driverId
 */
export const getAppleWalletPass = async (req, res) => {
  try {
    const { driverId } = req.params;

    // Verify driver exists and is active
    const driverResult = await query(
      `SELECT id, full_name, average_rating, profile_image_url, is_active
       FROM users
       WHERE id = $1 AND role = $2`,
      [driverId, 'driver']
    );

    if (driverResult.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    const driver = driverResult.rows[0];

    if (!driver.is_active) {
      return res.status(400).json({ error: 'Driver is not active' });
    }

    // Generate Apple Wallet pass
    const passStream = await generateAppleWalletPass(
      driver.id,
      driver.full_name,
      parseFloat(driver.average_rating),
      driver.profile_image_url
    );

    // Set response headers for .pkpass file download
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${driver.full_name.replace(/\s+/g, '_')}_Driver_Pass.pkpass"`
    );
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    // Pipe the archive stream to response
    passStream.pipe(res);

    // Handle errors
    passStream.on('error', (err) => {
      console.error('Error streaming Apple Wallet pass:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to generate wallet pass' });
      }
    });

    console.log(`✅ Apple Wallet pass generated for driver: ${driver.full_name}`);
  } catch (error) {
    console.error('Error in getAppleWalletPass:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate Apple Wallet pass' });
    }
  }
};

/**
 * Get Google Wallet pass link
 * @route GET /api/driver-wallet-pass/google/:driverId
 */
export const getGoogleWalletPass = async (req, res) => {
  try {
    const { driverId } = req.params;

    // Verify driver exists and is active
    const driverResult = await query(
      `SELECT id, full_name, average_rating, profile_image_url, is_active, phone
       FROM users
       WHERE id = $1 AND role = $2`,
      [driverId, 'driver']
    );

    if (driverResult.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    const driver = driverResult.rows[0];

    if (!driver.is_active) {
      return res.status(400).json({ error: 'Driver is not active' });
    }

    // Generate Google Wallet pass
    const passData = await generateGoogleWalletPass(
      driver.id,
      driver.full_name,
      parseFloat(driver.average_rating),
      driver.profile_image_url
    );

    res.json({
      success: passData.success,
      message: passData.message,
      data: {
        driverId: driver.id,
        driverName: driver.full_name,
        driverRating: parseFloat(driver.average_rating),
        walletUrl: passData.url,
        // For development/debugging
        isConfigured: passData.success,
      },
    });

    console.log(`✅ Google Wallet pass generated for driver: ${driver.full_name}`);
  } catch (error) {
    console.error('Error in getGoogleWalletPass:', error);
    res.status(500).json({ error: 'Failed to generate Google Wallet pass' });
  }
};

/**
 * Get wallet pass configuration status
 * @route GET /api/driver-wallet-pass/config
 */
export const getWalletPassConfig = async (req, res) => {
  try {
    const googleConfig = getGoogleWalletConfig();

    res.json({
      appleWallet: {
        available: true,
        description: 'Download .pkpass file and add to Apple Wallet',
        note: 'Certificate-based signing required for production',
      },
      googleWallet: {
        available: googleConfig.configured,
        status: googleConfig.message,
        configured: googleConfig.configured,
      },
    });
  } catch (error) {
    console.error('Error getting wallet pass config:', error);
    res.status(500).json({ error: 'Failed to get configuration' });
  }
};

/**
 * Validate wallet pass generation
 * @route POST /api/driver-wallet-pass/validate/:driverId
 */
export const validateWalletPassGeneration = async (req, res) => {
  try {
    const { driverId } = req.params;

    // Verify driver exists
    const driverResult = await query(
      `SELECT id, full_name, is_active FROM users
       WHERE id = $1 AND role = $2`,
      [driverId, 'driver']
    );

    if (driverResult.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    const driver = driverResult.rows[0];

    res.json({
      success: true,
      canGeneratePass: driver.is_active,
      driverId: driver.id,
      driverName: driver.full_name,
      message: driver.is_active
        ? 'Wallet pass can be generated'
        : 'Driver must be active to generate wallet pass',
    });
  } catch (error) {
    console.error('Error validating wallet pass:', error);
    res.status(500).json({ error: 'Validation failed' });
  }
};

/**
 * Track wallet pass additions (for analytics)
 * @route POST /api/driver-wallet-pass/track
 */
export const trackWalletPassAddition = async (req, res) => {
  try {
    const { driverId, walletType } = req.body; // walletType: 'apple' | 'google'

    if (!driverId || !walletType) {
      return res.status(400).json({
        error: 'driverId and walletType are required',
      });
    }

    // Log analytics (could be stored in database or analytics service)
    console.log(
      `📊 Driver ${driverId} added ${walletType} wallet pass at ${new Date().toISOString()}`
    );

    // Optional: Store in database for analytics
    // await query(
    //   `INSERT INTO wallet_pass_analytics (driver_id, wallet_type, created_at)
    //    VALUES ($1, $2, CURRENT_TIMESTAMP)`,
    //   [driverId, walletType]
    // );

    res.json({
      success: true,
      message: `${walletType} wallet pass addition tracked`,
    });
  } catch (error) {
    console.error('Error tracking wallet pass:', error);
    res.status(500).json({ error: 'Failed to track wallet pass' });
  }
};
