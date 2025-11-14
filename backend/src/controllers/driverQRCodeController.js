import pool from '../config/database.js';
import {
  generateDriverQRCode,
  generateDriverQRCodeSVG,
  parseDriverQRData,
} from '../utils/driverQRCode.js';

/**
 * Get driver QR code for their profile
 * This QR code can be scanned by clients to request delivery from this driver
 * @route GET /api/driver-qr-code/:driverId
 */
export const getDriverQRCode = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { format = 'png' } = req.query; // 'png' or 'svg'

    // Get driver information
    const driverResult = await pool.query(
      'SELECT id, full_name, average_rating, is_active FROM users WHERE id = $1 AND role = $2',
      [driverId, 'driver']
    );

    if (driverResult.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    const driver = driverResult.rows[0];

    if (!driver.is_active) {
      return res.status(400).json({ error: 'Driver is not active' });
    }

    // Generate QR code
    let qrCode;
    if (format === 'svg') {
      qrCode = await generateDriverQRCodeSVG(
        driver.id,
        driver.full_name,
        parseFloat(driver.average_rating)
      );
    } else {
      qrCode = await generateDriverQRCode(
        driver.id,
        driver.full_name,
        parseFloat(driver.average_rating)
      );
    }

    res.json({
      success: true,
      data: {
        driverId: driver.id,
        driverName: driver.full_name,
        driverRating: driver.average_rating,
        qrCode,
        format,
      },
    });
  } catch (err) {
    console.error('Error generating driver QR code:', err);
    res.status(500).json({ error: 'Failed to generate driver QR code' });
  }
};

/**
 * Verify driver from scanned QR code and get driver details
 * This is called when client scans a driver's QR code
 * @route POST /api/driver-qr-code/verify
 * @body { qrData: string (JSON encoded driver data) }
 */
export const verifyDriverQRCode = async (req, res) => {
  try {
    const { qrData } = req.body;

    if (!qrData) {
      return res.status(400).json({ error: 'QR data is required' });
    }

    // Parse QR data
    let driverInfo;
    try {
      driverInfo = parseDriverQRData(qrData);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    const { driverId } = driverInfo;

    // Verify driver exists and is active
    const driverResult = await pool.query(
      `SELECT id, full_name, average_rating, phone, address, profile_image_url
       FROM users
       WHERE id = $1 AND role = $2 AND is_active = true`,
      [driverId, 'driver']
    );

    if (driverResult.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found or is inactive' });
    }

    const driver = driverResult.rows[0];

    // Get delivery count for driver
    const deliveryCountResult = await pool.query(
      'SELECT COUNT(*) as delivery_count FROM deliveries WHERE driver_id = $1',
      [driverId]
    );

    const deliveryCount = parseInt(deliveryCountResult.rows[0].delivery_count, 10);

    res.json({
      success: true,
      data: {
        driverId: driver.id,
        driverName: driver.full_name,
        driverRating: parseFloat(driver.average_rating),
        driverPhone: driver.phone,
        driverAddress: driver.address,
        profileImageUrl: driver.profile_image_url,
        deliveryCount,
      },
    });
  } catch (err) {
    console.error('Error verifying driver QR code:', err);
    res.status(500).json({ error: 'Failed to verify driver QR code' });
  }
};

/**
 * Get driver profile information for display after QR scan
 * @route GET /api/driver-qr-code/:driverId/profile
 */
export const getDriverProfile = async (req, res) => {
  try {
    const { driverId } = req.params;

    // Get driver details
    const driverResult = await pool.query(
      `SELECT
        id,
        full_name,
        email,
        phone,
        address,
        average_rating,
        profile_image_url,
        is_active,
        created_at
       FROM users
       WHERE id = $1 AND role = $2`,
      [driverId, 'driver']
    );

    if (driverResult.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    const driver = driverResult.rows[0];

    // Get delivery stats
    const statsResult = await pool.query(
      `SELECT
        COUNT(*) as total_deliveries,
        SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as completed_deliveries
       FROM deliveries
       WHERE driver_id = $1`,
      [driverId]
    );

    const stats = statsResult.rows[0];

    // Get recent reviews
    const reviewsResult = await pool.query(
      `SELECT
        rating,
        comment,
        created_at,
        (SELECT full_name FROM users WHERE id = delivery_reviews.customer_id) as customer_name
       FROM delivery_reviews
       WHERE driver_id = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [driverId]
    );

    res.json({
      success: true,
      data: {
        driver: {
          id: driver.id,
          name: driver.full_name,
          email: driver.email,
          phone: driver.phone,
          address: driver.address,
          rating: parseFloat(driver.average_rating),
          profileImage: driver.profile_image_url,
          isActive: driver.is_active,
          joinedDate: driver.created_at,
        },
        stats: {
          totalDeliveries: parseInt(stats.total_deliveries, 10),
          completedDeliveries: parseInt(stats.completed_deliveries, 10),
          completionRate:
            stats.total_deliveries > 0
              ? ((stats.completed_deliveries / stats.total_deliveries) * 100).toFixed(1)
              : 0,
        },
        recentReviews: reviewsResult.rows.map((review) => ({
          rating: review.rating,
          comment: review.comment,
          customerName: review.customer_name,
          createdAt: review.created_at,
        })),
      },
    });
  } catch (err) {
    console.error('Error getting driver profile:', err);
    res.status(500).json({ error: 'Failed to get driver profile' });
  }
};
