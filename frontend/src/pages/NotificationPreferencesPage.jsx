import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/authContext';
import PhoneVerification from '../components/PhoneVerification';
import '../styles/notificationPreferences.css';

export default function NotificationPreferencesPage() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('channels'); // 'channels' | 'types' | 'logs' | 'stats'
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notification-preferences', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch preferences');

      const data = await response.json();
      setPreferences(data.preferences);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      setLogsLoading(true);
      const response = await fetch('/api/notification-preferences/logs?limit=50', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch logs');

      const data = await response.json();
      setLogs(data.logs);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load notification logs');
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const response = await fetch('/api/notification-preferences/stats', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch stats');

      const data = await response.json();
      setStats(data.stats);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load notification stats');
    } finally {
      setStatsLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'logs' && logs.length === 0) {
      fetchLogs();
    }
    if (tab === 'stats' && !stats) {
      fetchStats();
    }
  };

  const handlePreferenceChange = async (key, value) => {
    const updatedPreferences = { ...preferences, [key]: value };
    setPreferences(updatedPreferences);

    try {
      setSaving(true);
      const response = await fetch('/api/notification-preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ [key]: value }),
      });

      if (!response.ok) throw new Error('Failed to update preferences');

      setSuccessMessage('Preferences updated successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to update preferences');
      // Revert the change on error
      setPreferences((prev) => ({ ...prev, [key]: !value }));
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePhone = async () => {
    if (!window.confirm('Are you sure you want to remove your phone number?')) {
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/notification-preferences/phone', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to remove phone number');

      setPreferences((prev) => ({
        ...prev,
        phone_number: null,
        phone_verified: false,
        sms_notifications: false,
        whatsapp_notifications: false,
      }));

      setSuccessMessage('Phone number removed successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to remove phone number');
    } finally {
      setSaving(false);
    }
  };

  const maskPhoneNumber = (phone) => {
    if (!phone) return null;
    return phone.slice(0, -4) + '****';
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="notification-preferences-page">
        <div className="loading">Loading your notification preferences...</div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="notification-preferences-page">
        <div className="error-container">
          <p>{error || 'Failed to load preferences'}</p>
          <button onClick={fetchPreferences}>Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="notification-preferences-page">
      <header className="page-header">
        <h1>🔔 Notification Preferences</h1>
        <p>Manage how you receive notifications across all channels</p>
      </header>

      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      <div className="preferences-container">
        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'channels' ? 'active' : ''}`}
            onClick={() => handleTabChange('channels')}
          >
            📱 Channels
          </button>
          <button
            className={`tab ${activeTab === 'types' ? 'active' : ''}`}
            onClick={() => handleTabChange('types')}
          >
            🎯 Types
          </button>
          <button
            className={`tab ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => handleTabChange('logs')}
          >
            📜 Logs
          </button>
          <button
            className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => handleTabChange('stats')}
          >
            📊 Statistics
          </button>
        </div>

        {/* Channels Tab */}
        {activeTab === 'channels' && (
          <div className="tab-content channels-tab">
            <div className="section">
              <h2>📧 Email Notifications</h2>
              <div className="channel-card">
                <div className="channel-info">
                  <h3>Email</h3>
                  <p>Receive notifications via email to {user?.email}</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={preferences.email_notifications}
                    onChange={(e) => handlePreferenceChange('email_notifications', e.target.checked)}
                    disabled={saving}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div className="section">
              <h2>💬 SMS & WhatsApp</h2>

              {!preferences.phone_verified ? (
                <div className="phone-setup-section">
                  <p>Set up SMS and WhatsApp notifications by verifying your phone number</p>
                  {showPhoneVerification ? (
                    <PhoneVerification
                      onVerificationComplete={(phoneNumber) => {
                        setPreferences((prev) => ({
                          ...prev,
                          phone_number: phoneNumber,
                          phone_verified: true,
                          sms_notifications: true,
                          whatsapp_notifications: true,
                        }));
                        setShowPhoneVerification(false);
                        setSuccessMessage('Phone number verified successfully!');
                        setTimeout(() => setSuccessMessage(null), 3000);
                      }}
                    />
                  ) : (
                    <button
                      className="btn-verify-phone"
                      onClick={() => setShowPhoneVerification(true)}
                    >
                      📱 Verify Phone Number
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="phone-verified-info">
                    <p>✓ Phone verified: {maskPhoneNumber(preferences.phone_number)}</p>
                    <button className="btn-remove-phone" onClick={handleRemovePhone} disabled={saving}>
                      Remove Phone Number
                    </button>
                  </div>

                  <div className="channel-card">
                    <div className="channel-info">
                      <h3>SMS</h3>
                      <p>Receive text messages to {maskPhoneNumber(preferences.phone_number)}</p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={preferences.sms_notifications}
                        onChange={(e) => handlePreferenceChange('sms_notifications', e.target.checked)}
                        disabled={saving}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="channel-card">
                    <div className="channel-info">
                      <h3>WhatsApp</h3>
                      <p>Receive messages via WhatsApp to {maskPhoneNumber(preferences.phone_number)}</p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={preferences.whatsapp_notifications}
                        onChange={(e) => handlePreferenceChange('whatsapp_notifications', e.target.checked)}
                        disabled={saving}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </>
              )}
            </div>

            <div className="section">
              <h2>🌐 Browser & In-App</h2>
              <div className="channel-card">
                <div className="channel-info">
                  <h3>In-App Notifications</h3>
                  <p>See notifications within the app</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={preferences.in_app_notifications}
                    onChange={(e) => handlePreferenceChange('in_app_notifications', e.target.checked)}
                    disabled={saving}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="channel-card">
                <div className="channel-info">
                  <h3>Browser Notifications</h3>
                  <p>Receive push notifications in your browser</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={preferences.browser_notifications}
                    onChange={(e) => handlePreferenceChange('browser_notifications', e.target.checked)}
                    disabled={saving}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Types Tab */}
        {activeTab === 'types' && (
          <div className="tab-content types-tab">
            <p className="section-description">
              Choose which types of notifications you want to receive
            </p>

            <div className="notification-types">
              <div className="type-card">
                <div className="type-info">
                  <h3>🚗 Delivery Status Updates</h3>
                  <p>Receive notifications about your deliveries (pickup, in transit, delivered)</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={preferences.delivery_status_updates}
                    onChange={(e) => handlePreferenceChange('delivery_status_updates', e.target.checked)}
                    disabled={saving}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="type-card">
                <div className="type-info">
                  <h3>⭐ Points & Rewards Alerts</h3>
                  <p>Get notified when you earn points or rewards</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={preferences.points_alerts}
                    onChange={(e) => handlePreferenceChange('points_alerts', e.target.checked)}
                    disabled={saving}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="type-card">
                <div className="type-info">
                  <h3>🎉 Promotional Offers</h3>
                  <p>Receive special offers and promotional campaigns</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={preferences.promotional}
                    onChange={(e) => handlePreferenceChange('promotional', e.target.checked)}
                    disabled={saving}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="type-card">
                <div className="type-info">
                  <h3>📰 Weekly Digest</h3>
                  <p>Receive a weekly summary of your activity</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={preferences.weekly_digest}
                    onChange={(e) => handlePreferenceChange('weekly_digest', e.target.checked)}
                    disabled={saving}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="tab-content logs-tab">
            <div className="logs-header">
              <h2>📜 Notification Delivery Logs</h2>
              <p>View history of all notifications sent to you</p>
            </div>

            {logsLoading ? (
              <div className="loading">Loading notification logs...</div>
            ) : logs.length === 0 ? (
              <div className="empty-state">
                <p>No notifications sent yet</p>
              </div>
            ) : (
              <div className="logs-table">
                <div className="table-header">
                  <div className="col col-type">Type</div>
                  <div className="col col-channel">Channel</div>
                  <div className="col col-status">Status</div>
                  <div className="col col-time">Time</div>
                </div>
                {logs.map((log) => (
                  <div key={log.id} className="table-row">
                    <div className="col col-type">
                      <span className={`badge badge-${log.message_type}`}>
                        {log.message_type}
                      </span>
                    </div>
                    <div className="col col-channel">
                      <span className={`badge badge-channel badge-${log.channel}`}>
                        {log.channel}
                      </span>
                    </div>
                    <div className="col col-status">
                      <span className={`status ${log.delivery_status.toLowerCase()}`}>
                        {log.delivery_status}
                      </span>
                    </div>
                    <div className="col col-time">
                      {formatTime(log.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Statistics Tab */}
        {activeTab === 'stats' && (
          <div className="tab-content stats-tab">
            <div className="stats-header">
              <h2>📊 Notification Statistics</h2>
              <p>Overview of your notification delivery across all channels</p>
            </div>

            {statsLoading ? (
              <div className="loading">Loading statistics...</div>
            ) : stats ? (
              <>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-value">{stats.total_sent}</div>
                    <div className="stat-label">Total Sent</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{stats.total_delivered}</div>
                    <div className="stat-label">Delivered</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{stats.total_failed}</div>
                    <div className="stat-label">Failed</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">
                      {stats.total_sent > 0 ? Math.round((stats.total_delivered / stats.total_sent) * 100) : 0}%
                    </div>
                    <div className="stat-label">Success Rate</div>
                  </div>
                </div>

                <div className="channel-stats">
                  <h3>By Channel</h3>
                  <div className="channel-stats-grid">
                    {stats.by_channel && Object.entries(stats.by_channel).map(([channel, data]) => (
                      <div key={channel} className="channel-stat-card">
                        <h4>{channel}</h4>
                        <div className="stat-row">
                          <span>Sent:</span>
                          <strong>{data.sent}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Delivered:</span>
                          <strong>{data.delivered}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Failed:</span>
                          <strong>{data.failed}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="message-type-stats">
                  <h3>By Type</h3>
                  <div className="type-stats-grid">
                    {stats.by_message_type && Object.entries(stats.by_message_type).map(([type, count]) => (
                      <div key={type} className="type-stat-card">
                        <div className="stat-value">{count}</div>
                        <div className="stat-label">{type}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <p>No statistics available yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
