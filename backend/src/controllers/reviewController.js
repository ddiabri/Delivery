import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a review for a completed delivery
 */
export const createReview = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { deliveryId, driverId, rating, comment, is_anonymous } = req.validated;

    // Verify delivery exists and is completed
    const deliveryResult = await query(
      'SELECT id, customer_id, driver_id, status FROM deliveries WHERE id = $1',
      [deliveryId]
    );

    if (deliveryResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Delivery not found',
        code: 'DELIVERY_NOT_FOUND',
      });
    }

    const delivery = deliveryResult.rows[0];

    // Only customer who made the request can review
    if (delivery.customer_id !== customerId) {
      return res.status(403).json({
        error: 'Only the customer can review this delivery',
        code: 'FORBIDDEN',
      });
    }

    // Delivery must be completed
    if (delivery.status !== 'DELIVERED') {
      return res.status(400).json({
        error: 'Can only review completed deliveries',
        code: 'INVALID_STATUS',
      });
    }

    // Check if review already exists
    const existingReview = await query(
      'SELECT id FROM delivery_reviews WHERE delivery_id = $1 AND customer_id = $2',
      [deliveryId, customerId]
    );

    if (existingReview.rows.length > 0) {
      return res.status(409).json({
        error: 'You have already reviewed this delivery',
        code: 'REVIEW_EXISTS',
      });
    }

    const reviewId = uuidv4();

    const result = await query(
      `INSERT INTO delivery_reviews (id, delivery_id, customer_id, driver_id, rating, comment, is_anonymous)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, delivery_id, rating, comment, is_anonymous, created_at`,
      [reviewId, deliveryId, customerId, driverId, rating, comment || null, is_anonymous || false]
    );

    const review = result.rows[0];

    // Update driver's average rating
    await updateDriverRating(driverId);

    res.status(201).json({
      message: 'Review created successfully',
      review,
    });
  } catch (err) {
    console.error('Create review error:', err);
    res.status(500).json({
      error: 'Failed to create review',
      code: 'CREATE_ERROR',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

/**
 * Get reviews for a delivery
 */
export const getDeliveryReviews = async (req, res) => {
  try {
    const { deliveryId } = req.params;

    const result = await query(
      `SELECT
        dr.id, dr.delivery_id, dr.rating, dr.comment, dr.is_anonymous,
        dr.created_at,
        CASE
          WHEN dr.is_anonymous THEN 'Anonymous'
          ELSE u.full_name
        END as customer_name
      FROM delivery_reviews dr
      LEFT JOIN users u ON dr.customer_id = u.id
      WHERE dr.delivery_id = $1
      ORDER BY dr.created_at DESC`,
      [deliveryId]
    );

    res.status(200).json({
      message: 'Delivery reviews retrieved successfully',
      reviews: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    console.error('Get reviews error:', err);
    res.status(500).json({
      error: 'Failed to fetch reviews',
      code: 'FETCH_ERROR',
    });
  }
};

/**
 * Get driver's reviews and ratings
 */
export const getDriverReviews = async (req, res) => {
  try {
    const driverId = req.params.driverId || req.user.id;

    // Get driver stats
    const statsResult = await query(
      `SELECT
        COALESCE(AVG(rating), 0) as average_rating,
        COUNT(*) as total_reviews,
        COUNT(*) FILTER (WHERE rating = 5) as five_star,
        COUNT(*) FILTER (WHERE rating = 4) as four_star,
        COUNT(*) FILTER (WHERE rating = 3) as three_star,
        COUNT(*) FILTER (WHERE rating = 2) as two_star,
        COUNT(*) FILTER (WHERE rating = 1) as one_star
      FROM delivery_reviews
      WHERE driver_id = $1`,
      [driverId]
    );

    const stats = statsResult.rows[0];

    // Get recent reviews
    const reviewsResult = await query(
      `SELECT
        dr.id, dr.delivery_id, dr.rating, dr.comment, dr.is_anonymous,
        dr.created_at,
        CASE
          WHEN dr.is_anonymous THEN 'Anonymous'
          ELSE u.full_name
        END as customer_name
      FROM delivery_reviews dr
      LEFT JOIN users u ON dr.customer_id = u.id
      WHERE dr.driver_id = $1
      ORDER BY dr.created_at DESC
      LIMIT 20`,
      [driverId]
    );

    res.status(200).json({
      message: 'Driver reviews retrieved successfully',
      stats: {
        average_rating: parseFloat(stats.average_rating).toFixed(2),
        total_reviews: parseInt(stats.total_reviews),
        rating_distribution: {
          five_star: parseInt(stats.five_star),
          four_star: parseInt(stats.four_star),
          three_star: parseInt(stats.three_star),
          two_star: parseInt(stats.two_star),
          one_star: parseInt(stats.one_star),
        },
      },
      recent_reviews: reviewsResult.rows,
    });
  } catch (err) {
    console.error('Get driver reviews error:', err);
    res.status(500).json({
      error: 'Failed to fetch driver reviews',
      code: 'FETCH_ERROR',
    });
  }
};

/**
 * Update a review
 */
export const updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.validated;
    const customerId = req.user.id;

    // Get review
    const reviewResult = await query(
      'SELECT delivery_id, customer_id, driver_id FROM delivery_reviews WHERE id = $1',
      [id]
    );

    if (reviewResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Review not found',
        code: 'NOT_FOUND',
      });
    }

    const review = reviewResult.rows[0];

    // Only the customer who created the review can update it
    if (review.customer_id !== customerId) {
      return res.status(403).json({
        error: 'You can only update your own reviews',
        code: 'FORBIDDEN',
      });
    }

    // Update review
    const result = await query(
      `UPDATE delivery_reviews
       SET rating = $1, comment = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, rating, comment, updated_at`,
      [rating, comment || null, id]
    );

    // Update driver's average rating
    await updateDriverRating(review.driver_id);

    res.status(200).json({
      message: 'Review updated successfully',
      review: result.rows[0],
    });
  } catch (err) {
    console.error('Update review error:', err);
    res.status(500).json({
      error: 'Failed to update review',
      code: 'UPDATE_ERROR',
    });
  }
};

/**
 * Delete a review
 */
export const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const customerId = req.user.id;

    // Get review
    const reviewResult = await query(
      'SELECT customer_id, driver_id FROM delivery_reviews WHERE id = $1',
      [id]
    );

    if (reviewResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Review not found',
        code: 'NOT_FOUND',
      });
    }

    const review = reviewResult.rows[0];

    // Only the customer who created the review can delete it
    if (review.customer_id !== customerId) {
      return res.status(403).json({
        error: 'You can only delete your own reviews',
        code: 'FORBIDDEN',
      });
    }

    // Delete review
    await query('DELETE FROM delivery_reviews WHERE id = $1', [id]);

    // Update driver's average rating
    await updateDriverRating(review.driver_id);

    res.status(200).json({
      message: 'Review deleted successfully',
    });
  } catch (err) {
    console.error('Delete review error:', err);
    res.status(500).json({
      error: 'Failed to delete review',
      code: 'DELETE_ERROR',
    });
  }
};

/**
 * Helper function to update driver's average rating
 */
const updateDriverRating = async (driverId) => {
  try {
    await query(
      `UPDATE users
       SET average_rating = (
         SELECT COALESCE(AVG(rating), 0)
         FROM delivery_reviews
         WHERE driver_id = $1
       )
       WHERE id = $1`,
      [driverId]
    );
  } catch (err) {
    console.error('Update driver rating error:', err);
    // Don't throw, just log
  }
};

export default {
  createReview,
  getDeliveryReviews,
  getDriverReviews,
  updateReview,
  deleteReview,
};
