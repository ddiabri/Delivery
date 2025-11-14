import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';
import '../styles/analyticsDashboard.css';

export default function AnalyticsDashboardPage() {
  const navigate = useNavigate();
  const [deliveryStats, setDeliveryStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchDeliveryStats();
  }, [days]);

  const fetchDeliveryStats = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getDeliveryStats({ days });
      setDeliveryStats(response.data.data || []);
      setError('');
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const totals = deliveryStats.reduce(
    (acc, stat) => ({
      total: acc.total + stat.total,
      completed: acc.completed + stat.completed,
      cancelled: acc.cancelled + stat.cancelled,
    }),
    { total: 0, completed: 0, cancelled: 0 }
  );

  const maxDeliveries = Math.max(...deliveryStats.map(s => s.total), 1);

  return (
    <div className="analytics-page">
      <header className="page-header">
        <button className="btn-back" onClick={() => navigate('/admin')}>
          ← Back
        </button>
        <h1>Analytics Dashboard</h1>
      </header>

      <div className="analytics-container">
        {error && <div className="error-message">{error}</div>}

        {/* Controls */}
        <section className="controls-section">
          <div className="date-filter">
            <label>Time Period:</label>
            <select value={days} onChange={(e) => setDays(parseInt(e.target.value))}>
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
              <option value={365}>Last Year</option>
            </select>
          </div>
        </section>

        {/* Summary Stats */}
        <section className="summary-stats">
          <div className="stat-card">
            <span className="stat-label">Total Deliveries</span>
            <span className="stat-value">{totals.total.toLocaleString()}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Completed</span>
            <span className="stat-value success">{totals.completed.toLocaleString()}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Cancelled</span>
            <span className="stat-value danger">{totals.cancelled.toLocaleString()}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Success Rate</span>
            <span className="stat-value">
              {totals.total > 0 ? ((totals.completed / totals.total) * 100).toFixed(1) : 0}%
            </span>
          </div>
        </section>

        {/* Chart */}
        {loading ? (
          <div className="loading">Loading analytics...</div>
        ) : deliveryStats.length === 0 ? (
          <div className="empty-state">
            <p>No data available for this period</p>
          </div>
        ) : (
          <section className="chart-section">
            <h2>Deliveries Over Time</h2>
            <div className="chart-container">
              <div className="chart-legend">
                <span className="legend-item total">Total</span>
                <span className="legend-item completed">Completed</span>
                <span className="legend-item cancelled">Cancelled</span>
              </div>

              <div className="bar-chart">
                {deliveryStats.map((stat, index) => (
                  <div key={index} className="bar-group">
                    <div className="bars">
                      <div
                        className="bar total"
                        style={{
                          height: `${(stat.total / maxDeliveries) * 100}%`,
                        }}
                        title={`${stat.total} deliveries`}
                      />
                      <div
                        className="bar completed"
                        style={{
                          height: `${(stat.completed / maxDeliveries) * 100}%`,
                        }}
                        title={`${stat.completed} completed`}
                      />
                      <div
                        className="bar cancelled"
                        style={{
                          height: `${(stat.cancelled / maxDeliveries) * 100}%`,
                        }}
                        title={`${stat.cancelled} cancelled`}
                      />
                    </div>
                    <span className="date-label">
                      {new Date(stat.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span className="value-label">{stat.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Data Table */}
        {deliveryStats.length > 0 && (
          <section className="data-table-section">
            <h2>Detailed Data</h2>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Total</th>
                    <th>Completed</th>
                    <th>Cancelled</th>
                    <th>Completion %</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryStats.map((stat, index) => (
                    <tr key={index}>
                      <td>{new Date(stat.date).toLocaleDateString()}</td>
                      <td className="center">{stat.total}</td>
                      <td className="center success">{stat.completed}</td>
                      <td className="center danger">{stat.cancelled}</td>
                      <td className="center">
                        {stat.total > 0 ? ((stat.completed / stat.total) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
