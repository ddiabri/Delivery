import { pool } from '../config/database.js';
import { generateQRToken, generateQRCode, verifyQRToken, parseQRData } from '../utils/qrCode.js';

/**
 * Generate QR code for a delivery
 */
export const generateDeliveryQRCode = async (req, res) => {
  const { deliveryId } = req.params;
  const userId = req.user.id;

  try {
    // Verify delivery exists and user is owner
    const deliveryResult = await pool.query(
      `SELECT id, customer_id, qr_code_token FROM deliveries WHERE id = $1`,
      [deliveryId]
    );

    if (deliveryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    const delivery = deliveryResult.rows[0];

    // Only customer can request QR code
    if (delivery.customer_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Generate QR token if not exists
    let qrToken = delivery.qr_code_token;
    if (!qrToken) {
      qrToken = generateQRToken();
      await pool.query(
        `UPDATE deliveries SET qr_code_token = $1 WHERE id = $2`,
        [qrToken, deliveryId]
      );
    }

    // Generate QR code image
    const qrCodeData = {
      deliveryId,
      token: qrToken,
      timestamp: new Date().toISOString(),
    };

    const qrCodeImage = await generateQRCode(JSON.stringify(qrCodeData));

    res.json({
      success: true,
      data: {
        deliveryId,
        qrCode: qrCodeImage,
        qrToken,
        instructions: 'Share this QR code with your driver to confirm pickup',
      },
    });
  } catch (err) {
    console.error('Generate QR code error:', err);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
};

/**
 * Verify QR code and confirm pickup
 */
export const verifyQRCodePickup = async (req, res) => {
  const { deliveryId, qrData } = req.body;
  const driverId = req.user.id;

  try {
    // Get delivery
    const deliveryResult = await pool.query(
      `SELECT id, driver_id, status, qr_code_token FROM deliveries WHERE id = $1`,
      [deliveryId]
    );

    if (deliveryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    const delivery = deliveryResult.rows[0];

    // Verify driver is assigned
    if (delivery.driver_id !== driverId) {
      return res.status(403).json({ error: 'Not assigned to this delivery' });
    }

    // Check if already picked up
    if (delivery.status !== 'ACCEPTED') {
      return res.status(400).json({ error: 'Delivery is not in accepted status' });
    }

    // Parse QR data
    const parsedQR = parseQRData(qrData);
    if (!parsedQR) {
      return res.status(400).json({ error: 'Invalid QR code data' });
    }

    // Verify token
    if (!verifyQRToken(parsedQR.token, delivery.qr_code_token)) {
      return res.status(401).json({ error: 'QR code verification failed' });
    }

    // Update delivery status
    const updateResult = await pool.query(
      `UPDATE deliveries
       SET status = 'PICKED_UP',
           qr_code_scanned_at = NOW(),
           qr_code_scanned_by = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, status, qr_code_scanned_at`,
      [driverId, deliveryId]
    );

    res.json({
      success: true,
      message: 'Package pickup confirmed',
      data: updateResult.rows[0],
    });
  } catch (err) {
    console.error('Verify QR code error:', err);
    res.status(500).json({ error: 'Failed to verify QR code' });
  }
};

/**
 * Get QR code info for a delivery
 */
export const getQRCodeInfo = async (req, res) => {
  const { deliveryId } = req.params;
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT id, customer_id, driver_id, status, qr_code_token, qr_code_scanned_at, qr_code_scanned_by
       FROM deliveries WHERE id = $1`,
      [deliveryId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    const delivery = result.rows[0];

    // Verify authorization
    const isAuthorized =
      userId === delivery.customer_id || userId === delivery.driver_id;

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json({
      success: true,
      data: {
        deliveryId,
        status: delivery.status,
        qrCodeGenerated: !!delivery.qr_code_token,
        qrCodeScanned: !!delivery.qr_code_scanned_at,
        scanDetails: delivery.qr_code_scanned_at ? {
          scannedAt: delivery.qr_code_scanned_at,
          scannedBy: delivery.qr_code_scanned_by,
        } : null,
      },
    });
  } catch (err) {
    console.error('Get QR info error:', err);
    res.status(500).json({ error: 'Failed to fetch QR info' });
  }
};
