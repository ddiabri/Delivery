import React, { useState } from 'react';
import { reviewAPI } from '../services/api';
import '../styles/ratingForm.css';

export default function RatingForm({ deliveryId, driverId, onSuccess, onClose }) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    setLoading(true);

    try {
      await reviewAPI.createReview({
        deliveryId,
        driverId,
        rating,
        comment: comment.trim() || null,
        is_anonymous: isAnonymous,
      });

      onSuccess();
    } catch (err) {
      const errorMsg =
        err.response?.data?.error || 'Failed to submit review';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const StarRating = ({ currentRating }) => (
    <div className="star-rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`star ${star <= (hoveredRating || currentRating) ? 'filled' : ''}`}
          onClick={() => setRating(star)}
          onMouseEnter={() => setHoveredRating(star)}
          onMouseLeave={() => setHoveredRating(0)}
          aria-label={`Rate ${star} stars`}
        >
          ★
        </button>
      ))}
    </div>
  );

  return (
    <div className="rating-form-overlay">
      <div className="rating-form-container">
        <h2>Rate Your Delivery</h2>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>How was your delivery experience?</label>
            <StarRating currentRating={rating} />
            <div className="rating-label">
              {rating > 0 ? (
                <span className={`label-text rating-${rating}`}>
                  {rating === 5
                    ? '⭐ Excellent'
                    : rating === 4
                    ? '😊 Good'
                    : rating === 3
                    ? '😐 Average'
                    : rating === 2
                    ? '😞 Poor'
                    : '😠 Terrible'}
                </span>
              ) : (
                <span className="label-text">Select a rating</span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="comment">Additional Comments (Optional)</label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us about your experience... (max 500 characters)"
              maxLength="500"
              rows="4"
            />
            <div className="char-count">
              {comment.length}/500 characters
            </div>
          </div>

          <div className="form-group checkbox">
            <label>
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
              />
              <span>Post as anonymous</span>
            </label>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Skip
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={loading || rating === 0}
            >
              {loading ? 'Submitting...' : '✓ Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
