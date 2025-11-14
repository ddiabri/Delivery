import React, { useState, useEffect } from 'react';
import { reviewAPI } from '../services/api';
import '../styles/driverRating.css';

export default function DriverRating({ driverId, driverName = 'Driver' }) {
  const [driverStats, setDriverStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDriverRating();
  }, [driverId]);

  const fetchDriverRating = async () => {
    setLoading(true);
    try {
      const response = await reviewAPI.getDriverReviews(driverId);
      setDriverStats(response.data.data || response.data);
      setError('');
    } catch (err) {
      setError('Failed to load driver rating');
      setDriverStats(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="driver-rating loading">Loading rating...</div>;
  }

  if (error || !driverStats) {
    return (
      <div className="driver-rating error">
        <p>Rating unavailable</p>
      </div>
    );
  }

  const {
    average_rating = 0,
    total_reviews = 0,
    rating_distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  } = driverStats;

  const getRatingCategory = (rating) => {
    if (rating >= 4.5) return 'Excellent';
    if (rating >= 4) return 'Very Good';
    if (rating >= 3) return 'Good';
    if (rating >= 2) return 'Fair';
    return 'Poor';
  };

  const getRatingColor = (rating) => {
    if (rating >= 4.5) return '#4caf50';
    if (rating >= 4) return '#8bc34a';
    if (rating >= 3) return '#ffc107';
    if (rating >= 2) return '#ff9800';
    return '#f44336';
  };

  const getMaxReviews = () => {
    return Math.max(...Object.values(rating_distribution));
  };

  const maxReviews = getMaxReviews() || 1;

  return (
    <div className="driver-rating">
      {/* Overall Rating */}
      <div className="rating-overview">
        <div className="rating-score">
          <div className="score-display">
            <span className="score-value">{average_rating.toFixed(1)}</span>
            <span className="score-max">/5.0</span>
          </div>
          <div className="score-stars">
            {Array.from({ length: 5 }, (_, i) => (
              <span
                key={i}
                className={i < Math.round(average_rating) ? 'star filled' : 'star'}
              >
                ★
              </span>
            ))}
          </div>
          <p className="score-category">{getRatingCategory(average_rating)}</p>
        </div>

        <div className="rating-summary">
          <p className="summary-text">
            <strong>{total_reviews}</strong>
            {total_reviews === 1 ? ' review' : ' reviews'}
          </p>
          {total_reviews > 0 && (
            <p className="summary-subtitle">
              Based on completed deliveries
            </p>
          )}
          {total_reviews === 0 && (
            <p className="summary-subtitle">
              No reviews yet
            </p>
          )}
        </div>
      </div>

      {/* Rating Distribution */}
      {total_reviews > 0 && (
        <div className="rating-distribution">
          <h4>Rating Breakdown</h4>

          {[5, 4, 3, 2, 1].map((stars) => {
            const count = rating_distribution[stars] || 0;
            const percentage =
              total_reviews > 0 ? (count / total_reviews) * 100 : 0;

            return (
              <div key={stars} className="distribution-row">
                <div className="distribution-label">
                  <span className="stars">
                    {Array.from({ length: stars }, (_, i) => (
                      <span key={i} className="star-small">
                        ★
                      </span>
                    ))}
                  </span>
                  <span className="count">({count})</span>
                </div>

                <div className="distribution-bar">
                  <div
                    className="distribution-fill"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: getRatingColor(stars),
                    }}
                  />
                </div>

                <span className="distribution-percent">
                  {percentage.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Info Box */}
      {total_reviews === 0 && (
        <div className="rating-info-box">
          <p>
            This driver hasn't received any reviews yet. Reviews will appear
            after customers complete deliveries and submit feedback.
          </p>
        </div>
      )}
    </div>
  );
}
