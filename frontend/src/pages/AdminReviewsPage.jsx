import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';
import '../styles/adminReviews.css';

export default function AdminReviewsPage() {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [pagination, setPagination] = useState({
    limit: 20,
    offset: 0,
    total: 0,
  });

  useEffect(() => {
    fetchReviews();
  }, [ratingFilter, pagination.offset]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getReviewsForModeration({
        rating: ratingFilter || undefined,
        limit: pagination.limit,
        offset: pagination.offset,
      });

      setReviews(response.data.data || []);
      setPagination({
        ...pagination,
        total: response.data.pagination?.total || 0,
      });
      setError('');
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
      setError('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  const hasMore = pagination.offset + pagination.limit < pagination.total;
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  const getRatingColor = (rating) => {
    if (rating >= 4) return '#4caf50';
    if (rating >= 3) return '#ffc107';
    if (rating >= 2) return '#ff9800';
    return '#f44336';
  };

  return (
    <div className="admin-reviews-page">
      <header className="admin-header">
        <div className="header-content">
          <button
            className="btn-back"
            onClick={() => navigate('/admin')}
          >
            ← Back
          </button>
          <div>
            <h1>Review Moderation</h1>
            <p>Monitor and manage delivery reviews</p>
          </div>
        </div>
      </header>

      <div className="admin-container">
        {error && <div className="error-message">{error}</div>}

        {/* Filters */}
        <section className="filters-section">
          <div className="filter-group">
            <label>Filter by Rating</label>
            <select value={ratingFilter} onChange={(e) => {
              setRatingFilter(e.target.value);
              setPagination({ ...pagination, offset: 0 });
            }}>
              <option value="">All Reviews</option>
              <option value="2">1-2 stars (Low)</option>
              <option value="3">3 stars (Medium)</option>
              <option value="4">4+ stars (High)</option>
            </select>
          </div>

          <div className="filter-stats">
            <span>Total: {pagination.total}</span>
            <span>Page {currentPage} of {totalPages}</span>
          </div>
        </section>

        {/* Reviews Section */}
        <section className="reviews-section">
          {loading ? (
            <div className="loading">Loading reviews...</div>
          ) : reviews.length === 0 ? (
            <div className="empty-state">
              <p>No reviews found</p>
            </div>
          ) : (
            <>
              <div className="reviews-grid">
                {reviews.map((review) => (
                  <div key={review.id} className="review-card">
                    <div className="review-header">
                      <div className="review-meta">
                        <h4 className="customer-name">{review.customer_name}</h4>
                        <p className="driver-name">Reviewed driver: {review.driver_name}</p>
                        <p className="date">
                          {new Date(review.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="review-rating">
                        <span
                          className="rating-badge"
                          style={{ backgroundColor: getRatingColor(review.rating) }}
                        >
                          {review.rating} ⭐
                        </span>
                      </div>
                    </div>

                    <div className="review-body">
                      {review.comment && (
                        <p className="comment">{review.comment}</p>
                      )}
                      {review.is_anonymous && (
                        <p className="anonymous-note">👤 Posted anonymously</p>
                      )}
                    </div>

                    <div className="review-actions">
                      <button
                        className="btn-view"
                        onClick={() => navigate(`/delivery/${review.delivery_id}`)}
                        title="View delivery"
                      >
                        View Delivery
                      </button>
                      {review.rating <= 2 && (
                        <span className="flag-badge">⚠️ Flagged for Review</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="pagination">
                <button
                  className="btn-pagination"
                  onClick={() =>
                    setPagination({
                      ...pagination,
                      offset: Math.max(0, pagination.offset - pagination.limit),
                    })
                  }
                  disabled={pagination.offset === 0}
                >
                  ← Previous
                </button>

                <span className="page-info">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  className="btn-pagination"
                  onClick={() =>
                    setPagination({
                      ...pagination,
                      offset: pagination.offset + pagination.limit,
                    })
                  }
                  disabled={!hasMore}
                >
                  Next →
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
