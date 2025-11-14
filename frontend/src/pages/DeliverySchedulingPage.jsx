import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/authContext';
import '../styles/deliveryScheduling.css';

export default function DeliverySchedulingPage() {
  const { user } = useAuth();
  const [scheduledDeliveries, setScheduledDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('SCHEDULED');
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const [formData, setFormData] = useState({
    pickupAddress: '',
    deliveryAddress: '',
    packageDescription: '',
    packageWeight: '',
    priority: 'NORMAL',
    scheduledPickupTime: '',
    scheduledDeliveryTime: '',
    specialInstructions: '',
  });

  useEffect(() => {
    fetchScheduledDeliveries();
  }, [filter]);

  const fetchScheduledDeliveries = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/scheduled-deliveries?status=${filter}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch scheduled deliveries');

      const data = await response.json();
      setScheduledDeliveries(data.scheduledDeliveries);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      // Validate that delivery time is after pickup time
      const pickupTime = new Date(formData.scheduledPickupTime);
      const deliveryTime = new Date(formData.scheduledDeliveryTime);

      if (deliveryTime <= pickupTime) {
        setError('Delivery time must be after pickup time');
        return;
      }

      const response = await fetch('/api/scheduled-deliveries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          pickupAddress: formData.pickupAddress,
          deliveryAddress: formData.deliveryAddress,
          packageDescription: formData.packageDescription,
          packageWeight: formData.packageWeight ? parseFloat(formData.packageWeight) : null,
          priority: formData.priority,
          scheduledPickupTime: pickupTime.toISOString(),
          scheduledDeliveryTime: deliveryTime.toISOString(),
          specialInstructions: formData.specialInstructions,
          pickupLocation: { latitude: 0, longitude: 0 }, // TODO: Get from map/address
          deliveryLocation: { latitude: 0, longitude: 0 }, // TODO: Get from map/address
        }),
      });

      if (!response.ok) throw new Error('Failed to schedule delivery');

      const data = await response.json();
      setScheduledDeliveries([data.scheduledDelivery, ...scheduledDeliveries]);
      setSuccessMessage('Delivery scheduled successfully!');
      setShowForm(false);
      resetForm();

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled delivery?')) {
      return;
    }

    try {
      const response = await fetch(`/api/scheduled-deliveries/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to cancel delivery');

      setScheduledDeliveries(scheduledDeliveries.filter((d) => d.id !== id));
      setSuccessMessage('Delivery cancelled');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      pickupAddress: '',
      deliveryAddress: '',
      packageDescription: '',
      packageWeight: '',
      priority: 'NORMAL',
      scheduledPickupTime: '',
      scheduledDeliveryTime: '',
      specialInstructions: '',
    });
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getStatusBadge = (status) => {
    const badges = {
      SCHEDULED: { color: '#2196F3', label: '📅 Scheduled' },
      CONFIRMED: { color: '#4CAF50', label: '✅ Confirmed' },
      CANCELLED: { color: '#F44336', label: '❌ Cancelled' },
      CONVERTED: { color: '#9C27B0', label: '📦 Converted' },
    };
    const badge = badges[status] || badges.SCHEDULED;
    return badge;
  };

  return (
    <div className="delivery-scheduling-page">
      <header className="page-header">
        <h1>📅 Schedule Deliveries</h1>
        <p>Plan your deliveries in advance for guaranteed service</p>
      </header>

      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      <div className="scheduling-container">
        <div className="header-actions">
          <button className="btn-schedule" onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕ Close' : '+ Schedule Delivery'}
          </button>
        </div>

        {/* Scheduling Form */}
        {showForm && (
          <div className="scheduling-form-section">
            <h2>Schedule a New Delivery</h2>
            <form onSubmit={handleSubmit} className="scheduling-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Pickup Address *</label>
                  <input
                    type="text"
                    value={formData.pickupAddress}
                    onChange={(e) => setFormData({ ...formData, pickupAddress: e.target.value })}
                    placeholder="Enter pickup address"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Delivery Address *</label>
                  <input
                    type="text"
                    value={formData.deliveryAddress}
                    onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
                    placeholder="Enter delivery address"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Package Description</label>
                  <textarea
                    value={formData.packageDescription}
                    onChange={(e) => setFormData({ ...formData, packageDescription: e.target.value })}
                    placeholder="Describe your package"
                    rows="3"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Package Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.packageWeight}
                    onChange={(e) => setFormData({ ...formData, packageWeight: e.target.value })}
                    placeholder="0.0"
                  />
                </div>
                <div className="form-group">
                  <label>Priority *</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  >
                    <option value="LOW">Low (Standard)</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High (Express)</option>
                    <option value="URGENT">Urgent (Same day)</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Pickup Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledPickupTime}
                    onChange={(e) => setFormData({ ...formData, scheduledPickupTime: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Delivery Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledDeliveryTime}
                    onChange={(e) => setFormData({ ...formData, scheduledDeliveryTime: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group full-width">
                  <label>Special Instructions</label>
                  <textarea
                    value={formData.specialInstructions}
                    onChange={(e) => setFormData({ ...formData, specialInstructions: e.target.value })}
                    placeholder="Any special handling instructions?"
                    rows="2"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-submit">Schedule Delivery</button>
                <button type="button" className="btn-cancel" onClick={() => { setShowForm(false); resetForm(); }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="filters">
          <button
            className={`filter-btn ${filter === 'SCHEDULED' ? 'active' : ''}`}
            onClick={() => setFilter('SCHEDULED')}
          >
            📅 Scheduled
          </button>
          <button
            className={`filter-btn ${filter === 'CONFIRMED' ? 'active' : ''}`}
            onClick={() => setFilter('CONFIRMED')}
          >
            ✅ Confirmed
          </button>
          <button
            className={`filter-btn ${filter === 'CONVERTED' ? 'active' : ''}`}
            onClick={() => setFilter('CONVERTED')}
          >
            📦 Converted
          </button>
          <button
            className={`filter-btn ${filter === 'CANCELLED' ? 'active' : ''}`}
            onClick={() => setFilter('CANCELLED')}
          >
            ❌ Cancelled
          </button>
        </div>

        {/* Deliveries List */}
        {loading ? (
          <div className="loading">Loading scheduled deliveries...</div>
        ) : scheduledDeliveries.length === 0 ? (
          <div className="empty-state">
            <p>📭 No {filter.toLowerCase()} deliveries</p>
            <p className="sub-text">Start by scheduling your first delivery</p>
          </div>
        ) : (
          <div className="deliveries-list">
            {scheduledDeliveries.map((delivery) => {
              const statusBadge = getStatusBadge(delivery.status);
              return (
                <div key={delivery.id} className="delivery-card">
                  <div className="card-header">
                    <div className="delivery-info">
                      <h3>{delivery.packageDescription || 'Package'}</h3>
                      <span className="status-badge" style={{ backgroundColor: statusBadge.color }}>
                        {statusBadge.label}
                      </span>
                    </div>
                    <div className="priority-badge" data-priority={delivery.priority}>
                      {delivery.priority}
                    </div>
                  </div>

                  <div className="card-body">
                    <div className="address-group">
                      <div className="address">
                        <strong>📍 Pickup:</strong>
                        <p>{delivery.pickup_address}</p>
                      </div>
                      <div className="address">
                        <strong>🎯 Delivery:</strong>
                        <p>{delivery.delivery_address}</p>
                      </div>
                    </div>

                    <div className="times">
                      <div className="time">
                        <strong>⏰ Pickup Time:</strong>
                        <p>{formatDateTime(delivery.scheduled_pickup_time)}</p>
                      </div>
                      <div className="time">
                        <strong>📅 Delivery Time:</strong>
                        <p>{formatDateTime(delivery.scheduled_delivery_time)}</p>
                      </div>
                    </div>

                    {delivery.package_weight && (
                      <div className="weight">
                        <strong>⚖️ Weight:</strong>
                        <p>{delivery.package_weight} kg</p>
                      </div>
                    )}

                    {delivery.special_instructions && (
                      <div className="instructions">
                        <strong>📝 Instructions:</strong>
                        <p>{delivery.special_instructions}</p>
                      </div>
                    )}
                  </div>

                  {(delivery.status === 'SCHEDULED' || delivery.status === 'CONFIRMED') && (
                    <div className="card-footer">
                      <button
                        className="btn-cancel-delivery"
                        onClick={() => handleCancel(delivery.id)}
                      >
                        ❌ Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
