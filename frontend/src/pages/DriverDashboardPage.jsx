import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { adminAPI } from '../services/api';
import '../styles/driverDashboard.css';

export default function DriverDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('rating');

  useEffect(() => {
    fetchDriverAnalytics();
  }, []);

  const fetchDriverAnalytics = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getDriverAnalytics();
      let driversList = response.data.data || [];

      // Sort based on selected criteria
      if (sortBy === 'rating') {
        driversList.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
      } else if (sortBy === 'deliveries') {
        driversList.sort((a, b) => b.total_deliveries - a.total_deliveries);
      } else if (sortBy === 'completion') {
        driversList.sort((a, b) => b.completion_rate - a.completion_rate);
      }

      setDrivers(driversList);
      setError('');
    } catch (err) {
      console.error('Failed to fetch driver analytics:', err);
      setError('Failed to load driver analytics');
    } finally {
      setLoading(false);
    }
  };

  const getRatingColor = (rating) => {
    if (rating >= 4.5) return '#4caf50';
    if (rating >= 4) return '#8bc34a';
    if (rating >= 3) return '#ffc107';
    if (rating >= 2) return '#ff9800';
    return '#f44336';
  };

  return (
    <div className="driver-dashboard-page">
      <header className="page-header">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>
          ← Back
        </button>
        <h1>Driver Performance Analytics</h1>
      </header>

      <div className="dashboard-container">
        {error && <div className="error-message">{error}</div>}

        {/* Sort Controls */}
        <section className="controls-section">
          <div className="sort-controls">
            <label>Sort by:</label>
            <select value={sortBy} onChange={(e) => {
              setSortBy(e.target.value);
              fetchDriverAnalytics();
            }}>
              <option value="rating">⭐ Rating</option>
              <option value="deliveries">📦 Total Deliveries</option>
              <option value="completion">✓ Completion Rate</option>
            </select>
          </div>
          <span className="total-drivers">Total drivers: {drivers.length}</span>
        </section>

        {/* Drivers Grid */}
        {loading ? (
          <div className="loading">Loading driver analytics...</div>
        ) : drivers.length === 0 ? (
          <div className="empty-state">
            <p>No drivers found</p>
          </div>
        ) : (
          <div className="drivers-grid">
            {drivers.map((driver, index) => (
              <div key={driver.id} className="driver-card">
                {/* Rank Badge */}
                {index < 3 && (
                  <div className="rank-badge">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'} #{index + 1}
                  </div>
                )}

                {/* Driver Header */}
                <div className="driver-header">
                  <div className="driver-avatar">
                    {driver.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="driver-info">
                    <h3>{driver.full_name}</h3>
                    <p className="email">{driver.email}</p>
                  </div>
                </div>

                {/* Rating */}
                <div className="rating-section">
                  <span
                    className="rating-badge"
                    style={{ backgroundColor: getRatingColor(driver.average_rating) }}
                  >
                    {driver.average_rating?.toFixed(2) || 'N/A'} ⭐
                  </span>
                  <p className="rating-label">
                    ({driver.total_reviews} reviews)
                  </p>
                </div>

                {/* Stats Grid */}
                <div className="stats-grid">
                  <div className="stat">
                    <span className="stat-label">Total Deliveries</span>
                    <span className="stat-value">{driver.total_deliveries}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Completed</span>
                    <span className="stat-value">{driver.completed_deliveries}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Completion Rate</span>
                    <span className="stat-value">{driver.completion_rate}%</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="progress-section">
                  <label>Completion Rate</label>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${driver.completion_rate}%` }}
                    />
                  </div>
                </div>

                {/* Joined Date */}
                <p className="joined-date">
                  Joined {new Date(driver.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
