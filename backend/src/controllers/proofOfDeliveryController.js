import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { sendDeliveryStatusNotification, sendNotification } from '../utils/notificationService.js';

/**
 * Upload proof of delivery
 */
export const uploadProofOfDelivery = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const { notes, latitude, longitude } = req.validated;
    const userId = req.user.id;

    // Check if delivery exists and user is the assigned driver
    const deliveryResult = await query(
      'SELECT driver_id, status, customer_id FROM deliveries WHERE id = $1',
      [deliveryId]
    );

    if (deliveryResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Delivery not found',
        code: 'NOT_FOUND',
      });
    }

    const delivery = deliveryResult.rows[0];

    if (delivery.driver_id !== userId) {
      return res.status(403).json({
        error: 'Only the assigned driver can upload proof of delivery',
        code: 'FORBIDDEN',
      });
    }

    if (delivery.status !== 'IN_TRANSIT') {
      return res.status(400).json({
        error: 'Can only upload proof of delivery for IN_TRANSIT deliveries',
        code: 'INVALID_STATUS',
      });
    }

    // Handle file uploads (photo and signature)
    let photoUrl = null;
    let signatureUrl = null;

    // In a production app, you'd upload to cloud storage (S3, GCS, etc.)
    // For now, we'll store the file paths or URLs
    if (req.files?.photo) {
      // This would normally be handled by multer and uploaded to cloud
      photoUrl = `/uploads/pod/${deliveryId}_${Date.now()}_photo.jpg`;
    }

    if (req.files?.signature) {
      // This would normally be handled by multer and uploaded to cloud
      signatureUrl = `/uploads/pod/${deliveryId}_${Date.now()}_signature.png`;
    }

    // Create/update proof of delivery record
    const podId = uuidv4();
    const result = await query(
      `INSERT INTO proof_of_delivery (
        id, delivery_id, photo_url, signature_url, notes,
        delivery_lat, delivery_lon, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (delivery_id) DO UPDATE SET
        photo_url = COALESCE(EXCLUDED.photo_url, proof_of_delivery.photo_url),
        signature_url = COALESCE(EXCLUDED.signature_url, proof_of_delivery.signature_url),
        notes = COALESCE(EXCLUDED.notes, proof_of_delivery.notes),
        delivery_lat = COALESCE(EXCLUDED.delivery_lat, proof_of_delivery.delivery_lat),
        delivery_lon = COALESCE(EXCLUDED.delivery_lon, proof_of_delivery.delivery_lon),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        podId,
        deliveryId,
        photoUrl,
        signatureUrl,
        notes,
        latitude,
        longitude
      ]
    );

    const pod = result.rows[0];

    // Send notification to customer that proof of delivery is ready
    await sendNotification(delivery.customer_id, {
      type: 'POD_SUBMITTED',
      title: '📸 Proof of Delivery Received',
      body: 'The driver has submitted proof of delivery. Your delivery is almost complete!',
      deliveryId,
      actionUrl: `/delivery/${deliveryId}`,
      icon: '✅'
    });

    res.status(201).json({
      message: 'Proof of delivery uploaded successfully',
      pod,
    });
  } catch (err) {
    console.error('Upload POD error:', err);
    res.status(500).json({
      error: 'Failed to upload proof of delivery',
      code: 'UPLOAD_ERROR',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

/**
 * Get proof of delivery for a delivery
 */
export const getProofOfDelivery = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const userId = req.user.id;

    // Check authorization
    const deliveryResult = await query(
      'SELECT customer_id, driver_id FROM deliveries WHERE id = $1',
      [deliveryId]
    );

    if (deliveryResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Delivery not found',
        code: 'NOT_FOUND',
      });
    }

    const delivery = deliveryResult.rows[0];

    // Only customer, driver, or admin can view
    if (
      delivery.customer_id !== userId &&
      delivery.driver_id !== userId &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        error: 'Not authorized to view this proof of delivery',
        code: 'FORBIDDEN',
      });
    }

    const result = await query(
      'SELECT * FROM proof_of_delivery WHERE delivery_id = $1',
      [deliveryId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Proof of delivery not found',
        code: 'NOT_FOUND',
      });
    }

    res.status(200).json({
      pod: result.rows[0],
    });
  } catch (err) {
    console.error('Get POD error:', err);
    res.status(500).json({
      error: 'Failed to retrieve proof of delivery',
      code: 'GET_ERROR',
    });
  }
};

/**
 * Verify proof of delivery (admin only)
 */
export const verifyProofOfDelivery = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const userId = req.user.id;

    // Only admin or delivery customer can verify
    if (req.user.role !== 'admin') {
      const deliveryResult = await query(
        'SELECT customer_id FROM deliveries WHERE id = $1',
        [deliveryId]
      );

      if (deliveryResult.rows.length === 0 || deliveryResult.rows[0].customer_id !== userId) {
        return res.status(403).json({
          error: 'Not authorized to verify this proof of delivery',
          code: 'FORBIDDEN',
        });
      }
    }

    // Update verification
    const result = await query(
      `UPDATE proof_of_delivery
       SET verified_at = CURRENT_TIMESTAMP, verified_by = $2
       WHERE delivery_id = $1
       RETURNING *`,
      [deliveryId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Proof of delivery not found',
        code: 'NOT_FOUND',
      });
    }

    res.status(200).json({
      message: 'Proof of delivery verified',
      pod: result.rows[0],
    });
  } catch (err) {
    console.error('Verify POD error:', err);
    res.status(500).json({
      error: 'Failed to verify proof of delivery',
      code: 'VERIFY_ERROR',
    });
  }
};

/**
 * Reject proof of delivery (admin only)
 */
export const rejectProofOfDelivery = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const { reason } = req.validated;

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Only admins can reject proof of delivery',
        code: 'FORBIDDEN',
      });
    }

    // Get delivery info
    const deliveryResult = await query(
      'SELECT driver_id, customer_id FROM deliveries WHERE id = $1',
      [deliveryId]
    );

    if (deliveryResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Delivery not found',
        code: 'NOT_FOUND',
      });
    }

    const delivery = deliveryResult.rows[0];

    // Delete the POD record
    await query(
      'DELETE FROM proof_of_delivery WHERE delivery_id = $1',
      [deliveryId]
    );

    // Notify driver
    await sendNotification(delivery.driver_id, {
      type: 'POD_REJECTED',
      title: '❌ Proof of Delivery Rejected',
      body: `Your proof of delivery for this delivery has been rejected. Reason: ${reason}. Please resubmit.`,
      deliveryId,
      actionUrl: `/delivery/${deliveryId}`,
      icon: '⚠️'
    });

    // Notify customer
    await sendNotification(delivery.customer_id, {
      type: 'POD_REJECTED',
      title: '⚠️ Proof of Delivery Issue',
      body: `The proof of delivery for your delivery needs to be resubmitted. ${reason}`,
      deliveryId,
      actionUrl: `/delivery/${deliveryId}`,
      icon: '⚠️'
    });

    res.status(200).json({
      message: 'Proof of delivery rejected',
    });
  } catch (err) {
    console.error('Reject POD error:', err);
    res.status(500).json({
      error: 'Failed to reject proof of delivery',
      code: 'REJECT_ERROR',
    });
  }
};

export default {
  uploadProofOfDelivery,
  getProofOfDelivery,
  verifyProofOfDelivery,
  rejectProofOfDelivery,
};
