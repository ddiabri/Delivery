import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { useDelivery } from '../context/deliveryContext';
import { getSocket, reviewAPI } from '../services/api';
import RatingForm from '../components/RatingForm';
import ReviewsList from '../components/ReviewsList';
import DriverRating from '../components/DriverRating';
import Chat from '../components/Chat';
import '../styles/deliveryDetail.css';

export default function DeliveryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentDelivery, fetchDeliveryById, updateDeliveryStatus, loading } = useDelivery();
  const [driverLocation, setDriverLocation] = useState(null);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [userHasReviewed, setUserHasReviewed] = useState(false);

  const socket = getSocket();

  useEffect(() => {
    fetchDeliveryById(id);
    fetchReviews();
  }, [id]);

  const fetchReviews = async () => {
    setLoadingReviews(true);
    try {
      const response = await reviewAPI.getDeliveryReviews(id);
      const reviewsList = response.data.data || response.data || [];
      setReviews(reviewsList);

      // Check if current user has already reviewed
      if (user?.id) {
        const hasReviewed = reviewsList.some(
          (review) => review.customer_id === user.id
        );
        setUserHasReviewed(hasReviewed);
      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
    } finally {
      setLoadingReviews(false);
    }
  };

  // Listen for driver location updates
  useEffect(() => {
    socket?.on('driver:location:update', (data) => {
      if (data.driverId === currentDelivery?.driver_id) {
        setDriverLocation(data);
      }
    });

    return () => {
      socket?.off('driver:location:update');
    };
  }, [socket, currentDelivery?.driver_id]);

  const getNextStatus = () => {
    const workflow = {
      PENDING: 'ACCEPTED',
      ACCEPTED: 'PICKED_UP',
      PICKED_UP: 'IN_TRANSIT',
      IN_TRANSIT: 'DELIVERED',
    };
    return workflow[currentDelivery?.status];
  };

  const handleStatusUpdate = async () => {
    const nextStatus = getNextStatus();
    if (!nextStatus) return;

    setUpdating(true);
    try {
      await updateDeliveryStatus(currentDelivery.id, nextStatus);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update delivery');
    } finally {
      setUpdating(false);
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
      <div className="delivery-detail-page">
        <div className="loading">Loading delivery details...</div>
      </div>
    );
  }

  if (!currentDelivery) {
    return (
      <div className="delivery-detail-page">
        <div className="error">Delivery not found</div>
      </div>
    );
  }

  const isDriver = user?.role === 'driver';
  const isCustomer = user?.role === 'customer';
  const canUpdateStatus = isDriver && currentDelivery.driver_id === user?.id;
  const nextStatus = getNextStatus();

  return (
    <div className="delivery-detail-page">
      <header className="page-header">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>
          ← Back
        </button>
        <h1>Delivery Details</h1>
      </header>

      <div className="detail-container">
        {error && <div className="error-message">{error}</div>}

        {/* Status Timeline */}
        <div className="status-timeline">
          <div className={`timeline-step ${['PENDING'].includes(currentDelivery.status) ? 'active' : currentDelivery.status !== 'PENDING' ? 'completed' : ''}`}>
            <div className="step-dot"></div>
            <div className="step-label">Requested</div>
          </div>

          <div className="timeline-line"></div>

          <div className={`timeline-step ${['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'].includes(currentDelivery.status) ? currentDelivery.status === 'ACCEPTED' ? 'active' : 'completed' : ''}`}>
            <div className="step-dot"></div>
            <div className="step-label">Accepted</div>
          </div>

          <div className="timeline-line"></div>

          <div className={`timeline-step ${['PICKED_UP', 'IN_TRANSIT', 'DELIVERED'].includes(currentDelivery.status) ? currentDelivery.status === 'PICKED_UP' ? 'active' : 'completed' : ''}`}>
            <div className="step-dot"></div>
            <div className="step-label">Picked Up</div>
          </div>

          <div className="timeline-line"></div>

          <div className={`timeline-step ${['IN_TRANSIT', 'DELIVERED'].includes(currentDelivery.status) ? currentDelivery.status === 'IN_TRANSIT' ? 'active' : 'completed' : ''}`}>
            <div className="step-dot"></div>
            <div className="step-label">In Transit</div>
          </div>

          <div className="timeline-line"></div>

          <div className={`timeline-step ${currentDelivery.status === 'DELIVERED' ? 'completed' : ''}`}>
            <div className="step-dot"></div>
            <div className="step-label">Delivered</div>
          </div>
        </div>

        {/* Main Content */}
        <div className="content-grid">
          {/* Left Column */}
          <div className="content-left">
            {/* Locations */}
            <div className="card">
              <h2>📍 Locations</h2>

              <div className="location-block">
                <h3>Pickup</h3>
                <p className="address">{currentDelivery.pickup_address}</p>
                <p className="coords">
                  {currentDelivery.pickup_location}
                </p>
              </div>

              <div className="divider">↓</div>

              <div className="location-block">
                <h3>Delivery</h3>
                <p className="address">{currentDelivery.delivery_address}</p>
                <p className="coords">
                  {currentDelivery.delivery_location}
                </p>
              </div>
            </div>

            {/* Package Details */}
            <div className="card">
              <h2>📦 Package Details</h2>

              <div className="detail-row">
                <span className="label">Description:</span>
                <span className="value">{currentDelivery.package_description}</span>
              </div>

              {currentDelivery.package_weight && (
                <div className="detail-row">
                  <span className="label">Weight:</span>
                  <span className="value">{currentDelivery.package_weight} kg</span>
                </div>
              )}

              <div className="detail-row">
                <span className="label">Priority:</span>
                <span className={`priority-badge ${currentDelivery.priority.toLowerCase()}`}>
                  {currentDelivery.priority}
                </span>
              </div>

              {currentDelivery.special_instructions && (
                <div className="detail-row">
                  <span className="label">Special Instructions:</span>
                  <span className="value">{currentDelivery.special_instructions}</span>
                </div>
              )}
            </div>

            {/* Contact Information */}
            <div className="card">
              <h2>👤 Contact Information</h2>

              {isDriver && (
                <div className="contact-block">
                  <h3>Customer</h3>
                  <p className="name">{currentDelivery.customer_name}</p>
                  <p className="phone">📞 {currentDelivery.customer_phone}</p>
                </div>
              )}

              {isCustomer && currentDelivery.driver_id && (
                <div className="contact-block">
                  <h3>Driver</h3>
                  <p className="name">{currentDelivery.driver_name}</p>
                  <p className="phone">📞 {currentDelivery.driver_phone}</p>
                </div>
              )}

              {isCustomer && !currentDelivery.driver_id && (
                <div className="contact-block">
                  <p className="no-driver">Waiting for a driver to accept...</p>
                </div>
              )}
            </div>

            {/* Driver Rating (Customer View) */}
            {isCustomer && currentDelivery.driver_id && (
              <div className="card">
                <h2>⭐ Driver Rating</h2>
                <DriverRating
                  driverId={currentDelivery.driver_id}
                  driverName={currentDelivery.driver_name}
                />
              </div>
            )}

            {/* Reviews Section */}
            {currentDelivery.status === 'DELIVERED' && (
              <div className="card">
                <h2>💬 Reviews</h2>
                {loadingReviews ? (
                  <p style={{ color: '#999', fontSize: '14px' }}>Loading reviews...</p>
                ) : (
                  <ReviewsList
                    reviews={reviews}
                    deliveryId={id}
                    currentUserId={user?.id}
                    onReviewDeleted={() => fetchReviews()}
                    onReviewUpdated={() => fetchReviews()}
                  />
                )}
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="content-right">
            {/* Chat Section */}
            {currentDelivery.driver_id && (
              <div className="card chat-card">
                <h2>💬 Messages</h2>
                <Chat
                  deliveryId={id}
                  currentUserId={user?.id}
                  otherUserId={
                    isDriver
                      ? currentDelivery.customer_id
                      : currentDelivery.driver_id
                  }
                  otherUserName={
                    isDriver
                      ? currentDelivery.customer_name
                      : currentDelivery.driver_name
                  }
                />
              </div>
            )}

            {/* Status Card */}
            <div className="status-card">
              <div className="status-icon" style={{ color: getStatusColor(currentDelivery.status) }}>
                {getStatusIcon(currentDelivery.status)}
              </div>
              <h3 className="status-title">{currentDelivery.status}</h3>
              <p className="status-time">
                Last updated: {new Date(currentDelivery.updated_at).toLocaleString()}
              </p>
            </div>

            {/* Driver Location (if in transit) */}
            {driverLocation && isCustomer && (
              <div className="card">
                <h2>🗺️ Driver Location</h2>
                <div className="location-coords">
                  <p>Lat: {driverLocation.latitude?.toFixed(4)}</p>
                  <p>Lon: {driverLocation.longitude?.toFixed(4)}</p>
                  {driverLocation.speed && (
                    <p>Speed: {driverLocation.speed.toFixed(1)} m/s</p>
                  )}
                </div>
              </div>
            )}

            {/* Timing */}
            <div className="card">
              <h2>⏰ Timing</h2>

              <div className="detail-row">
                <span className="label">Requested:</span>
                <span className="value">
                  {new Date(currentDelivery.created_at).toLocaleString()}
                </span>
              </div>

              {currentDelivery.estimated_delivery_time && (
                <div className="detail-row">
                  <span className="label">Est. Delivery:</span>
                  <span className="value">
                    {new Date(currentDelivery.estimated_delivery_time).toLocaleString()}
                  </span>
                </div>
              )}

              {currentDelivery.actual_delivery_time && (
                <div className="detail-row">
                  <span className="label">Delivered:</span>
                  <span className="value">
                    {new Date(currentDelivery.actual_delivery_time).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Action Button */}
            {canUpdateStatus && nextStatus && (
              <div className="action-button">
                <button
                  className="btn-update-status"
                  onClick={handleStatusUpdate}
                  disabled={updating}
                >
                  {updating ? 'Updating...' : `✓ Mark as ${nextStatus}`}
                </button>
              </div>
            )}

            {currentDelivery.status === 'DELIVERED' && (
              <div className="completed-badge">
                ✓ Delivery Completed
              </div>
            )}

            {/* Rate Delivery Button (Customer) */}
            {isCustomer && currentDelivery.status === 'DELIVERED' && !userHasReviewed && (
              <div className="action-button">
                <button
                  className="btn-rate-delivery"
                  onClick={() => setShowRatingForm(true)}
                >
                  ⭐ Leave a Review
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rating Form Modal */}
      {showRatingForm && isCustomer && currentDelivery.status === 'DELIVERED' && (
        <RatingForm
          deliveryId={id}
          driverId={currentDelivery.driver_id}
          driverName={currentDelivery.driver_name}
          onClose={() => setShowRatingForm(false)}
          onSuccess={() => {
            setShowRatingForm(false);
            fetchReviews();
          }}
        />
      )}
    </div>
  );
}
