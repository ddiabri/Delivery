import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { driverAPI, getSocket } from '../services/api';
import '../styles/availableDeliveries.css';

export default function AvailableDeliveriesPage() {
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState([]);
  const [location, setLocation] = useState({ latitude: 0, longitude: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    priority: 'ALL',
    sortBy: 'distance',
  });
  const [accepting, setAccepting] = useState(null);

  const socket = getSocket();

  // Get current location and fetch deliveries
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLocation({ latitude, longitude });
          fetchAvailableDeliveries(latitude, longitude);
        },
        (error) => {
          setError('Please enable location services to find deliveries');
          setLoading(false);
        }
      );
    } else {
      setError('Geolocation is not supported');
      setLoading(false);
    }
  }, []);

  const fetchAvailableDeliveries = async (lat, lng) => {
    try {
      setLoading(true);
      const params = {
        latitude: lat,
        longitude: lng,
        limit: 50,
      };

      if (filters.priority !== 'ALL') {
        params.priority = filters.priority;
      }

      const response = await driverAPI.getAvailableDeliveries(params);
      setDeliveries(response.data.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch deliveries');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAcceptDelivery = async (deliveryId) => {
    try {
      setAccepting(deliveryId);

      // Update delivery status to ACCEPTED
      const response = await driverAPI.acceptDelivery(deliveryId);

      // Emit WebSocket event to notify customers
      socket?.emit('delivery:status:update', {
        deliveryId,
        status: 'ACCEPTED',
        driverId: response.data.delivery.driver_id,
      });

      // Remove from available list
      setDeliveries((prev) => prev.filter((d) => d.id !== deliveryId));

      // Navigate to delivery detail
      navigate(`/delivery/${deliveryId}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to accept delivery');
      setAccepting(null);
    }
  };

  const handleRefresh = () => {
    fetchAvailableDeliveries(location.latitude, location.longitude);
  };

  const sortDeliveries = (list) => {
    const sorted = [...list];
    if (filters.sortBy === 'distance') {
      sorted.sort((a, b) => a.distance_km - b.distance_km);
    } else if (filters.sortBy === 'priority') {
      const priorityOrder = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
      sorted.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    }
    return sorted;
  };

  const filteredDeliveries =
    filters.priority === 'ALL'
      ? deliveries
      : deliveries.filter((d) => d.priority === filters.priority);

  const sortedDeliveries = sortDeliveries(filteredDeliveries);

  return (
    <div className="available-deliveries-page">
      <header className="page-header">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>
          ← Back
        </button>
        <h1>Available Deliveries</h1>
        <button className="btn-refresh" onClick={handleRefresh} disabled={loading}>
          🔄 Refresh
        </button>
      </header>

      <div className="available-container">
        {/* Filters Section */}
        <div className="filters-section">
          <div className="filter-group">
            <label htmlFor="priority">Priority</label>
            <select
              id="priority"
              name="priority"
              value={filters.priority}
              onChange={handleFilterChange}
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">🔴 Urgent</option>
              <option value="HIGH">🟠 High</option>
              <option value="NORMAL">🟡 Normal</option>
              <option value="LOW">🟢 Low</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="sortBy">Sort By</label>
            <select
              id="sortBy"
              name="sortBy"
              value={filters.sortBy}
              onChange={handleFilterChange}
            >
              <option value="distance">Distance (Nearest First)</option>
              <option value="priority">Priority (Highest First)</option>
            </select>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* Deliveries List */}
        <div className="deliveries-section">
          {loading ? (
            <div className="loading">Loading available deliveries...</div>
          ) : sortedDeliveries.length === 0 ? (
            <div className="empty-state">
              <p>
                {filteredDeliveries.length === 0
                  ? 'No deliveries available in your area'
                  : 'No deliveries match your filters'}
              </p>
              {filteredDeliveries.length === 0 && (
                <button onClick={handleRefresh} className="btn-refresh-empty">
                  Refresh to Check Again
                </button>
              )}
            </div>
          ) : (
            <div className="deliveries-grid">
              {sortedDeliveries.map((delivery) => (
                <div key={delivery.id} className="delivery-card">
                  <div className="card-header">
                    <h3>📍 Pickup</h3>
                    <span className={`priority-badge ${delivery.priority.toLowerCase()}`}>
                      {delivery.priority}
                    </span>
                  </div>

                  <div className="location-info">
                    <p className="address">{delivery.pickup_address}</p>
                  </div>

                  <div className="location-divider">↓ {delivery.distance_km.toFixed(1)} km</div>

                  <div className="card-section">
                    <h3>🏠 Delivery</h3>
                    <p className="address">{delivery.delivery_address}</p>
                  </div>

                  <div className="card-section">
                    <h4>📦 Package</h4>
                    <p className="description">{delivery.package_description}</p>
                    {delivery.package_weight && (
                      <p className="meta">Weight: {delivery.package_weight} kg</p>
                    )}
                  </div>

                  {delivery.special_instructions && (
                    <div className="card-section">
                      <h4>📝 Special Instructions</h4>
                      <p className="description">{delivery.special_instructions}</p>
                    </div>
                  )}

                  <div className="card-footer">
                    <span className="customer-info">
                      📞 {delivery.customer_phone}
                    </span>
                    <button
                      className="btn-accept"
                      onClick={() => handleAcceptDelivery(delivery.id)}
                      disabled={accepting === delivery.id}
                    >
                      {accepting === delivery.id ? 'Accepting...' : '✓ Accept'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {sortedDeliveries.length > 0 && (
            <div className="deliveries-info">
              Showing {sortedDeliveries.length} delivery
              {sortedDeliveries.length !== 1 ? 'ies' : ''}
            </div>
          )}
        </div>

        {/* Location Info */}
        <div className="location-info-footer">
          📍 Searching near: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
        </div>
      </div>
    </div>
  );
}
