import React, { useState } from 'react';
import { reviewAPI } from '../services/api';
import '../styles/reviewsList.css';

export default function ReviewsList({ reviews = [], deliveryId, currentUserId, onReviewDeleted, onReviewUpdated }) {
  const [editingId, setEditingId] = useState(null);
  const [editRating, setEditRating] = useState(null);
  const [editComment, setEditComment] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [updating, setUpdating] = useState(null);
  const [error, setError] = useState('');

  const handleEditClick = (review) => {
    setEditingId(review.id);
    setEditRating(review.rating);
    setEditComment(review.comment || '');
    setError('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditRating(null);
    setEditComment('');
  };

  const handleUpdateReview = async (reviewId) => {
    if (!editRating) {
      setError('Please select a rating');
      return;
    }

    setUpdating(reviewId);
    try {
      await reviewAPI.updateReview(reviewId, {
        rating: editRating,
        comment: editComment,
      });
      setEditingId(null);
      setError('');
      onReviewUpdated && onReviewUpdated();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update review');
    } finally {
      setUpdating(null);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Are you sure you want to delete this review?')) return;

    setDeleting(reviewId);
    try {
      await reviewAPI.deleteReview(reviewId);
      setError('');
      onReviewDeleted && onReviewDeleted();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete review');
    } finally {
      setDeleting(null);
    }
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < rating ? 'star filled' : 'star'}>
        ★
      </span>
    ));
  };

  const getRatingLabel = (rating) => {
    const labels = {
      5: 'Excellent',
      4: 'Good',
      3: 'Average',
      2: 'Poor',
      1: 'Terrible',
    };
    return labels[rating] || 'N/A';
  };

  if (!reviews || reviews.length === 0) {
    return (
      <div className="reviews-empty">
        <p>No reviews yet</p>
      </div>
    );
  }

  return (
    <div className="reviews-list">
      {error && <div className="reviews-error">{error}</div>}

      {reviews.map((review) => (
        <div key={review.id} className="review-card">
          {editingId === review.id ? (
            // Edit Mode
            <div className="review-edit-mode">
              <div className="edit-section">
                <label>Rating</label>
                <div className="star-rating-edit">
                  {Array.from({ length: 5 }, (_, i) => (
                    <button
                      key={i}
                      className={`star-button ${i < editRating ? 'filled' : ''}`}
                      onClick={() => setEditRating(i + 1)}
                      type="button"
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div className="edit-section">
                <label>Comment</label>
                <textarea
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value.substring(0, 500))}
                  placeholder="Share your experience..."
                  maxLength="500"
                />
                <div className="char-count">
                  {editComment.length}/500
                </div>
              </div>

              <div className="edit-actions">
                <button
                  className="btn-save"
                  onClick={() => handleUpdateReview(review.id)}
                  disabled={updating === review.id}
                >
                  {updating === review.id ? 'Saving...' : 'Save'}
                </button>
                <button
                  className="btn-cancel-edit"
                  onClick={handleCancelEdit}
                  disabled={updating === review.id}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            // View Mode
            <>
              <div className="review-header">
                <div className="review-meta">
                  <p className="review-author">
                    {review.is_anonymous ? '👤 Anonymous' : `👤 ${review.customer_name || 'User'}`}
                  </p>
                  <p className="review-date">
                    {new Date(review.created_at).toLocaleDateString()}
                  </p>
                </div>
                {currentUserId === review.customer_id && (
                  <div className="review-actions">
                    <button
                      className="btn-edit-review"
                      onClick={() => handleEditClick(review)}
                      title="Edit review"
                    >
                      ✎
                    </button>
                    <button
                      className="btn-delete-review"
                      onClick={() => handleDeleteReview(review.id)}
                      disabled={deleting === review.id}
                      title="Delete review"
                    >
                      {deleting === review.id ? '...' : '✕'}
                    </button>
                  </div>
                )}
              </div>

              <div className="review-rating">
                <div className="stars-display">
                  {renderStars(review.rating)}
                </div>
                <span className="rating-label">{getRatingLabel(review.rating)}</span>
              </div>

              {review.comment && (
                <p className="review-comment">{review.comment}</p>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
