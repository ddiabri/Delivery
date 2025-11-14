import React from 'react';
import '../styles/driverProfileModal.css';

export default function DriverProfileModal({ driverInfo, onClose, onProceed }) {
  if (!driverInfo) return null;

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < fullStars; i++) {
      stars.push(<span key={`full-${i}`}>⭐</span>);
    }

    if (hasHalfStar && fullStars < 5) {
      stars.push(<span key="half">✨</span>);
    }

    return stars;
  };

  return (
    <div className="driver-profile-modal-overlay">
      <div className="driver-profile-modal">
        <button className="btn-close" onClick={onClose}>
          ✕
        </button>

        <div className="driver-header">
          {driverInfo.profileImageUrl && (
            <img
              src={driverInfo.profileImageUrl}
              alt={driverInfo.driverName}
              className="driver-avatar"
            />
          )}
          <h2>{driverInfo.driverName}</h2>
        </div>

        <div className="driver-rating">
          <div className="stars">{renderStars(driverInfo.driverRating)}</div>
          <span className="rating-value">{driverInfo.driverRating.toFixed(1)}</span>
        </div>

        <div className="driver-stats">
          <div className="stat">
            <div className="stat-label">Deliveries</div>
            <div className="stat-value">{driverInfo.deliveryCount}</div>
          </div>
        </div>

        <div className="driver-contact">
          {driverInfo.driverPhone && (
            <div className="contact-item">
              <span className="contact-label">📞 Phone:</span>
              <span className="contact-value">{driverInfo.driverPhone}</span>
            </div>
          )}
          {driverInfo.driverAddress && (
            <div className="contact-item">
              <span className="contact-label">📍 Location:</span>
              <span className="contact-value">{driverInfo.driverAddress}</span>
            </div>
          )}
        </div>

        <div className="driver-actions">
          <button className="btn-proceed" onClick={() => onProceed(driverInfo.driverId)}>
            ✓ Request Delivery from {driverInfo.driverName}
          </button>
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
