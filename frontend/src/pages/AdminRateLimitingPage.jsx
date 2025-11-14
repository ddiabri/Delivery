import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/authContext';
import '../styles/adminPages.css';

export default function AdminRateLimitingPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [whitelist, setWhitelist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWhitelistForm, setShowWhitelistForm] = useState(false);
  const [newWhitelistEntry, setNewWhitelistEntry] = useState({ ip_address: '', description: '' });
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('stats');

  useEffect(() => {
    if (user?.role !== 'admin') {
      setError('Access denied. Admin only.');
      return;
    }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, whitelistRes] = await Promise.all([
        fetch('/api/rate-limit/stats', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }),
        fetch('/api/rate-limit/whitelist', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        })
      ]);

      if (!statsRes.ok || !whitelistRes.ok) throw new Error('Failed to fetch data');

      const statsData = await statsRes.json();
      const whitelistData = await whitelistRes.json();

      setStats(statsData.stats);
      setWhitelist(whitelistData.whitelist);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddWhitelist = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/rate-limit/whitelist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(newWhitelistEntry),
      });

      if (!response.ok) throw new Error('Failed to add IP');

      setWhitelist([...whitelist, newWhitelistEntry]);
      setNewWhitelistEntry({ ip_address: '', description: '' });
      setShowWhitelistForm(false);
      setSuccessMessage('IP added to whitelist!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveWhitelist = async (ip) => {
    if (!window.confirm(`Remove ${ip} from whitelist?`)) return;

    try {
      const response = await fetch(`/api/rate-limit/whitelist/${ip}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      if (!response.ok) throw new Error('Failed to remove IP');

      setWhitelist(whitelist.filter((w) => w.ip_address !== ip));
      setSuccessMessage('IP removed from whitelist!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="admin-page">
      <header className="page-header">
        <h1>🛡️ Rate Limiting Management</h1>
        <p>Monitor and manage API rate limiting and security</p>
      </header>

      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      <div className="admin-container">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            📊 Statistics
          </button>
          <button
            className={`tab ${activeTab === 'whitelist' ? 'active' : ''}`}
            onClick={() => setActiveTab('whitelist')}
          >
            ✅ Whitelist
          </button>
        </div>

        {loading ? (
          <div className="loading">Loading rate limiting data...</div>
        ) : (
          <>
            {activeTab === 'stats' && stats && (
              <>
                {/* Today's Stats */}
                <section className="stats-section">
                  <h2>Today's Statistics</h2>
                  <div className="stats-summary">
                    <div className="stat-box">
                      <div className="stat-value">{stats.cacheSize}</div>
                      <div className="stat-label">Active Limits</div>
                    </div>
                    <div className="stat-box">
                      <div className="stat-value">{stats.whitelistSize}</div>
                      <div className="stat-label">Whitelisted IPs</div>
                    </div>
                  </div>

                  {stats.today.length > 0 ? (
                    <div className="stats-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Endpoint</th>
                            <th>Method</th>
                            <th>Total Requests</th>
                            <th>Blocked</th>
                            <th>Unique IPs</th>
                            <th>Unique Users</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.today.map((stat, idx) => (
                            <tr key={idx}>
                              <td>{stat.endpoint}</td>
                              <td><span className="badge">{stat.method}</span></td>
                              <td>{stat.total_requests}</td>
                              <td>
                                <span className={stat.blocked_requests > 0 ? 'danger' : 'success'}>
                                  {stat.blocked_requests}
                                </span>
                              </td>
                              <td>{stat.unique_ips}</td>
                              <td>{stat.unique_users}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="empty">No statistics available</p>
                  )}
                </section>

                {/* Currently Blocked */}
                {stats.currentlyBlocked.length > 0 && (
                  <section className="blocked-section">
                    <h2>⚠️ Currently Blocked</h2>
                    <div className="blocked-list">
                      {stats.currentlyBlocked.map((item, idx) => (
                        <div key={idx} className="blocked-item">
                          <div className="blocked-info">
                            <strong>{item.ip_address || item.user_id}</strong>
                            <p>{item.endpoint} - {item.block_reason}</p>
                            <small>Until: {formatTime(item.block_until)}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Hourly Trend */}
                {stats.trend.length > 0 && (
                  <section className="trend-section">
                    <h2>📈 Last 24 Hours Trend</h2>
                    <div className="trend-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Hour</th>
                            <th>Requests</th>
                            <th>Violations</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.trend.map((trend, idx) => (
                            <tr key={idx}>
                              <td>{new Date(trend.hour).toLocaleString()}</td>
                              <td>{trend.requests}</td>
                              <td>
                                <span className={trend.violations > 0 ? 'danger' : 'success'}>
                                  {trend.violations}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </>
            )}

            {activeTab === 'whitelist' && (
              <>
                <div className="whitelist-header">
                  <h2>IP Whitelist Management</h2>
                  <button
                    className="btn-primary"
                    onClick={() => setShowWhitelistForm(!showWhitelistForm)}
                  >
                    {showWhitelistForm ? '✕ Close' : '+ Add IP'}
                  </button>
                </div>

                {showWhitelistForm && (
                  <div className="form-section">
                    <h3>Add IP to Whitelist</h3>
                    <form onSubmit={handleAddWhitelist}>
                      <div className="form-row">
                        <div className="form-group">
                          <label>IP Address *</label>
                          <input
                            type="text"
                            value={newWhitelistEntry.ip_address}
                            onChange={(e) => setNewWhitelistEntry({ ...newWhitelistEntry, ip_address: e.target.value })}
                            placeholder="e.g., 192.168.1.1 or 2001:db8::1"
                            required
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label>Description</label>
                        <input
                          type="text"
                          value={newWhitelistEntry.description}
                          onChange={(e) => setNewWhitelistEntry({ ...newWhitelistEntry, description: e.target.value })}
                          placeholder="e.g., Office network, Partner API"
                        />
                      </div>

                      <div className="form-actions">
                        <button type="submit" className="btn-submit">Add to Whitelist</button>
                        <button type="button" className="btn-cancel" onClick={() => setShowWhitelistForm(false)}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {whitelist.length > 0 ? (
                  <div className="whitelist-list">
                    {whitelist.map((entry) => (
                      <div key={entry.id} className="whitelist-item">
                        <div className="whitelist-info">
                          <strong>{entry.ip_address}</strong>
                          <p>{entry.description || 'No description'}</p>
                          <small>Added by: {entry.created_by_name} • {formatTime(entry.created_at)}</small>
                        </div>
                        <button
                          className="btn-remove"
                          onClick={() => handleRemoveWhitelist(entry.ip_address)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty">No whitelisted IPs yet</p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
