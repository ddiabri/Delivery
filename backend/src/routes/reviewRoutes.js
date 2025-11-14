import express from 'express';
import {
  createReview,
  getDeliveryReviews,
  getDriverReviews,
  updateReview,
  deleteReview,
} from '../controllers/reviewController.js';
import { authenticateToken, authorizeRole } from '../middleware/authMiddleware.js';
import { validateMiddleware, reviewSchemas } from '../utils/validation.js';

const router = express.Router();

// All review routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/reviews
 * @desc    Create a review for a completed delivery
 * @access  Private (Customer)
 */
router.post(
  '/',
  authorizeRole('customer'),
  validateMiddleware(reviewSchemas.create),
  createReview
);

/**
 * @route   GET /api/reviews/delivery/:deliveryId
 * @desc    Get all reviews for a specific delivery
 * @access  Private
 */
router.get('/delivery/:deliveryId', getDeliveryReviews);

/**
 * @route   GET /api/reviews/driver/:driverId
 * @desc    Get driver's reviews and rating statistics
 * @access  Private
 */
router.get('/driver/:driverId', getDriverReviews);

/**
 * @route   GET /api/reviews/driver/me
 * @desc    Get current user's (driver) reviews
 * @access  Private (Driver)
 */
router.get('/driver/me', authorizeRole('driver'), (req, res) => {
  // Redirect to driver reviews endpoint with user's id
  res.redirect(`/api/reviews/driver/${req.user.id}`);
});

/**
 * @route   PUT /api/reviews/:id
 * @desc    Update a review
 * @access  Private (Review owner)
 */
router.put(
  '/:id',
  validateMiddleware(reviewSchemas.update),
  updateReview
);

/**
 * @route   DELETE /api/reviews/:id
 * @desc    Delete a review
 * @access  Private (Review owner)
 */
router.delete('/:id', deleteReview);

export default router;
