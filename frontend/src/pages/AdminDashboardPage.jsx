import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';
import '../styles/adminDashboard.css';

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getDashboardStats();
      setStats(response.data.data);
      setError('');
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
      setError('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard-page">
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.total_users || 0,
      icon: '👥',
      color: '#667eea',
      onClick: () => navigate('/admin/users'),
    },
    {
      title: 'Active Drivers',
      value: stats?.total_drivers || 0,
      icon: '🚗',
      color: '#764ba2',
      onClick: () => navigate('/admin/drivers'),
    },
    {
      title: 'Total Deliveries',
      value: stats?.total_deliveries || 0,
      icon: '📦',
      color: '#f093fb',
      onClick: () => navigate('/admin/deliveries'),
    },
    {
      title: 'Today\'s Deliveries',
      value: stats?.today_deliveries || 0,
      icon: '📅',
      color: '#4facfe',
    },
    {
      title: 'Completed',
      value: stats?.completed_deliveries || 0,
      icon: '✓',
      color: '#43e97b',
    },
    {
      title: 'Total Reviews',
      value: stats?.total_reviews || 0,
      icon: '⭐',
      color: '#fa709a',
      onClick: () => navigate('/admin/reviews'),
    },
  ];

  return (
    <div className="admin-dashboard-page">
      <header className="admin-header">
        <h1>Admin Dashboard</h1>
        <p>System Overview & Management</p>
      </header>

      <div className="admin-container">
        {error && <div className="error-message">{error}</div>}

        {/* Statistics Grid */}
        <section className="stats-section">
          <h2>Key Metrics</h2>
          <div className="stats-grid">
            {statCards.map((card, index) => (
              <div
                key={index}
                className={`stat-card ${card.onClick ? 'clickable' : ''}`}
                onClick={card.onClick}
              >
                <div className="stat-icon" style={{ color: card.color }}>
                  {card.icon}
                </div>
                <div className="stat-content">
                  <p className="stat-title">{card.title}</p>
                  <p className="stat-value">{card.value.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Delivery Status Breakdown */}
        <section className="status-breakdown-section">
          <h2>Delivery Status Breakdown</h2>
          <div className="status-breakdown">
            {stats?.status_breakdown && Object.entries(stats.status_breakdown).map(
              ([status, count]) => {
                const statusColors = {
                  PENDING: '#ffc107',
                  ACCEPTED: '#2196f3',
                  PICKED_UP: '#2196f3',
                  IN_TRANSIT: '#4caf50',
                  DELIVERED: '#4caf50',
                  CANCELLED: '#f44336',
                };

                const percentage =
                  stats.total_deliveries > 0
                    ? ((count / stats.total_deliveries) * 100).toFixed(1)
                    : 0;

                return (
                  <div key={status} className="status-item">
                    <div className="status-header">
                      <span className="status-name">{status}</span>
                      <span className="status-count">{count}</span>
                    </div>
                    <div className="status-bar">
                      <div
                        className="status-fill"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: statusColors[status],
                        }}
                      />
                    </div>
                    <span className="status-percentage">{percentage}%</span>
                  </div>
                );
              }
            )}
          </div>
        </section>

        {/* Quick Actions */}
        <section className="quick-actions-section">
          <h2>Quick Actions</h2>
          <div className="quick-actions">
            <button
              className="action-btn"
              onClick={() => navigate('/admin/users')}
            >
              <span className="action-icon">👥</span>
              <span>Manage Users</span>
            </button>
            <button
              className="action-btn"
              onClick={() => navigate('/admin/deliveries')}
            >
              <span className="action-icon">📦</span>
              <span>View Deliveries</span>
            </button>
            <button
              className="action-btn"
              onClick={() => navigate('/admin/drivers')}
            >
              <span className="action-icon">🚗</span>
              <span>Driver Analytics</span>
            </button>
            <button
              className="action-btn"
              onClick={() => navigate('/admin/reviews')}
            >
              <span className="action-icon">📋</span>
              <span>Review Moderation</span>
            </button>
            <button
              className="action-btn"
              onClick={() => navigate('/admin/analytics')}
            >
              <span className="action-icon">📊</span>
              <span>View Analytics</span>
            </button>
            <button
              className="action-btn"
              onClick={fetchDashboardStats}
            >
              <span className="action-icon">🔄</span>
              <span>Refresh Stats</span>
            </button>
          </div>
        </section>

        {/* System Info */}
        <section className="system-info-section">
          <h2>System Information</h2>
          <div className="system-info">
            <div className="info-item">
              <label>Average Driver Rating</label>
              <value>{(stats?.average_rating || 0).toFixed(2)} ⭐</value>
            </div>
            <div className="info-item">
              <label>Completion Rate</label>
              <value>
                {stats?.total_deliveries > 0
                  ? (
                      ((stats.completed_deliveries || 0) /
                        stats.total_deliveries) *
                      100
                    ).toFixed(1)
                  : 0}
                %
              </value>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
