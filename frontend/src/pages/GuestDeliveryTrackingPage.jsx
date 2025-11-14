import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { guestDeliveryAPI } from '../services/api';
import '../styles/guestTracking.css';

export default function GuestDeliveryTrackingPage() {
  const { deliveryId } = useParams();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Get token from URL query params
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');

    if (urlToken) {
      setToken(urlToken);
      fetchDelivery(urlToken);
    } else {
      setShowTokenInput(true);
      setLoading(false);
    }
  }, [deliveryId]);

  const fetchDelivery = async (guestToken) => {
    try {
      setLoading(true);
      const response = await guestDeliveryAPI.getGuestDelivery(deliveryId, guestToken);
      setDelivery(response.data.data);
      setError('');
      setShowTokenInput(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch delivery details');
      console.error('Error fetching delivery:', err);
      setShowTokenInput(true);
    } finally {
      setLoading(false);
    }
  };

  const handleTokenSubmit = (e) => {
    e.preventDefault();
    if (token.trim()) {
      fetchDelivery(token);
    } else {
      setError('Please enter your tracking token');
    }
  };

  const handleRefresh = async () => {
    if (token) {
      setRefreshing(true);
      await fetchDelivery(token);
      setRefreshing(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this delivery?')) {
      return;
    }

    try {
      await guestDeliveryAPI.cancelGuestDelivery(deliveryId, token);
      await fetchDelivery(token);
      alert('Delivery cancelled successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel delivery');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      PENDING: '#ffc107',
      ACCEPTED: '#2196f3',
      PICKED_UP: '#2196f3',
      IN_TRANSIT: '#4caf50',
      DELIVERED: '#4caf50',
      CANCELLED: '#f44336',
    };
    return colors[status] || '#999';
  };

  const getStatusIcon = (status) => {
    const icons = {
      PENDING: '⏳',
      ACCEPTED: '✓',
      PICKED_UP: '📦',
      IN_TRANSIT: '🚗',
      DELIVERED: '✓✓',
      CANCELLED: '✕',
    };
    return icons[status] || '?';
  };

  if (loading) {
    return (
      <div className="guest-tracking-page">
        <div className="loading">Loading delivery information...</div>
      </div>
    );
  }

  if (showTokenInput) {
    return (
      <div className="guest-tracking-page">
        <header className="page-header">
          <button className="btn-back" onClick={() => navigate('/')}>
            ← Back
          </button>
          <h1>Track Your Delivery</h1>
        </header>

        <div className="tracking-container">
          <div className="token-input-card">
            <h2>Enter Your Tracking Information</h2>
            <p>Use the tracking token from your delivery confirmation email or message.</p>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleTokenSubmit} className="token-form">
              <div className="form-group">
                <label htmlFor="token">Tracking Token</label>
                <input
                  type="text"
                  id="token"
                  value={token}
                  onChange={(e) => setToken(e.target.value.toUpperCase())}
                  placeholder="e.g., A1B2C3D4E5F6G7H8"
                  required
                />
              </div>

              <button type="submit" className="btn-search">
                🔍 Search Delivery
              </button>
            </form>

            <div className="token-tips">
              <h3>💡 Don't have a token?</h3>
              <p>If you don't have your tracking token, check:</p>
              <ul>
                <li>Your email or SMS inbox</li>
                <li>The confirmation page after requesting delivery</li>
                <li>Contact the delivery service for support</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="guest-tracking-page">
        <div className="error-screen">
          <h2>Delivery Not Found</h2>
          <p>{error}</p>
          <button className="btn-back-home" onClick={() => navigate('/')}>
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="guest-tracking-page">
      <header className="page-header">
        <button className="btn-back" onClick={() => navigate('/')}>
          ← Back
        </button>
        <h1>Track Your Delivery</h1>
      </header>

      <div className="tracking-container">
        {error && <div className="error-message">{error}</div>}

        {/* Status Timeline */}
        <div className="status-timeline">
          <div className={`timeline-step ${['PENDING'].includes(delivery.status) ? 'active' : delivery.status !== 'PENDING' ? 'completed' : ''}`}>
            <div className="step-dot"></div>
            <div className="step-label">Requested</div>
          </div>

          <div className="timeline-line"></div>

          <div className={`timeline-step ${['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'].includes(delivery.status) ? delivery.status === 'ACCEPTED' ? 'active' : 'completed' : ''}`}>
            <div className="step-dot"></div>
            <div className="step-label">Accepted</div>
          </div>

          <div className="timeline-line"></div>

          <div className={`timeline-step ${['PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'].includes(delivery.status) ? delivery.status === 'PICKED_UP' ? 'active' : 'completed' : ''}`}>
            <div className="step-dot"></div>
            <div className="step-label">Picked Up</div>
          </div>

          <div className="timeline-line"></div>

          <div className={`timeline-step ${['IN_TRANSIT', 'DELIVERED'].includes(delivery.status) ? delivery.status === 'IN_TRANSIT' ? 'active' : 'completed' : ''}`}>
            <div className="step-dot"></div>
            <div className="step-label">In Transit</div>
          </div>

          <div className="timeline-line"></div>

          <div className={`timeline-step ${delivery.status === 'DELIVERED' ? 'completed' : ''}`}>
            <div className="step-dot"></div>
            <div className="step-label">Delivered</div>
          </div>
        </div>

        {/* Status Card */}
        <div className="status-card">
          <div className="status-icon" style={{ color: getStatusColor(delivery.status) }}>
            {getStatusIcon(delivery.status)}
          </div>
          <h2 className="status-title">{delivery.status}</h2>
          <p className="status-time">
            Updated: {new Date(delivery.updatedAt).toLocaleString()}
          </p>
        </div>

        {/* Delivery Details */}
        <div className="details-grid">
          {/* Locations */}
          <div className="card">
            <h3>📍 Locations</h3>
            <div className="location-block">
              <h4>Pickup</h4>
              <p className="address">{delivery.pickupAddress}</p>
            </div>
            <div className="divider">↓</div>
            <div className="location-block">
              <h4>Delivery</h4>
              <p className="address">{delivery.deliveryAddress}</p>
            </div>
          </div>

          {/* Package Details */}
          <div className="card">
            <h3>📦 Package Details</h3>
            <div className="detail-item">
              <span className="label">Description:</span>
              <span className="value">{delivery.packageDescription}</span>
            </div>
            {delivery.packageWeight && (
              <div className="detail-item">
                <span className="label">Weight:</span>
                <span className="value">{delivery.packageWeight} kg</span>
              </div>
            )}
            <div className="detail-item">
              <span className="label">Priority:</span>
              <span className={`priority-badge ${delivery.priority.toLowerCase()}`}>
                {delivery.priority}
              </span>
            </div>
          </div>

          {/* Guest Information */}
          <div className="card">
            <h3>👤 Your Information</h3>
            <div className="detail-item">
              <span className="label">Name:</span>
              <span className="value">{delivery.guestName}</span>
            </div>
            <div className="detail-item">
              <span className="label">Phone:</span>
              <span className="value">{delivery.guestPhone}</span>
            </div>
            {delivery.guestEmail && (
              <div className="detail-item">
                <span className="label">Email:</span>
                <span className="value">{delivery.guestEmail}</span>
              </div>
            )}
          </div>

          {/* Driver Information */}
          {delivery.driverId && (
            <div className="card">
              <h3>🚗 Driver Information</h3>
              <div className="detail-item">
                <span className="label">Name:</span>
                <span className="value">{delivery.driverName || 'Not assigned yet'}</span>
              </div>
              {delivery.driverPhone && (
                <div className="detail-item">
                  <span className="label">Phone:</span>
                  <span className="value">{delivery.driverPhone}</span>
                </div>
              )}
              {delivery.driverRating && (
                <div className="detail-item">
                  <span className="label">Rating:</span>
                  <span className="value">⭐ {delivery.driverRating.toFixed(1)}</span>
                </div>
              )}
            </div>
          )}

          {/* Timing */}
          <div className="card">
            <h3>⏰ Timing</h3>
            <div className="detail-item">
              <span className="label">Requested:</span>
              <span className="value">
                {new Date(delivery.createdAt).toLocaleString()}
              </span>
            </div>
            {delivery.estimatedDeliveryTime && (
              <div className="detail-item">
                <span className="label">Est. Delivery:</span>
                <span className="value">
                  {new Date(delivery.estimatedDeliveryTime).toLocaleString()}
                </span>
              </div>
            )}
            {delivery.actualDeliveryTime && (
              <div className="detail-item">
                <span className="label">Delivered:</span>
                <span className="value">
                  {new Date(delivery.actualDeliveryTime).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button
            className="btn-refresh"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? '⟳ Refreshing...' : '⟳ Refresh Status'}
          </button>

          {['PENDING', 'ACCEPTED'].includes(delivery.status) && (
            <button
              className="btn-cancel"
              onClick={handleCancel}
            >
              ✕ Cancel Delivery
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
