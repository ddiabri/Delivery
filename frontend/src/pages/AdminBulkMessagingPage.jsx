import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/authContext';
import '../styles/adminPages.css';

export default function AdminBulkMessagingPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [formData, setFormData] = useState({
    message_type: 'SMS',
    target_user_type: 'ALL',
    message_subject: '',
    message_template: '',
  });

  useEffect(() => {
    if (user?.role !== 'admin') {
      setError('Access denied. Admin only.');
      return;
    }
    fetchMessages();
  }, [user]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/bulk-messages', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      setMessages(data.bulkMessages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/bulk-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error('Failed to create message');
      const data = await response.json();
      setMessages([data.bulkMessage, ...messages]);
      setSuccessMessage('Bulk message created!');
      setShowForm(false);
      setFormData({ message_type: 'SMS', target_user_type: 'ALL', message_subject: '', message_template: '' });
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSend = async (id) => {
    if (!window.confirm('Send this bulk message now?')) return;
    try {
      const response = await fetch(`/api/bulk-messages/${id}/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error('Failed to send message');
      fetchMessages();
      setSuccessMessage('Message sent!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="admin-page">
      <header className="page-header">
        <h1>📨 Bulk Messaging</h1>
        <p>Send SMS, WhatsApp, or email to multiple users</p>
      </header>

      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      <div className="admin-container">
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Close' : '+ New Message'}
        </button>

        {showForm && (
          <div className="form-section">
            <h2>Create Bulk Message</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Message Type *</label>
                  <select value={formData.message_type} onChange={(e) => setFormData({ ...formData, message_type: e.target.value })} required>
                    <option value="SMS">SMS</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">Email</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Target Users *</label>
                  <select value={formData.target_user_type} onChange={(e) => setFormData({ ...formData, target_user_type: e.target.value })} required>
                    <option value="ALL">All Users</option>
                    <option value="CUSTOMER">Customers Only</option>
                    <option value="DRIVER">Drivers Only</option>
                  </select>
                </div>
              </div>

              {formData.message_type === 'EMAIL' && (
                <div className="form-group">
                  <label>Email Subject</label>
                  <input
                    type="text"
                    value={formData.message_subject}
                    onChange={(e) => setFormData({ ...formData, message_subject: e.target.value })}
                    placeholder="Email subject"
                  />
                </div>
              )}

              <div className="form-group">
                <label>Message Template *</label>
                <textarea
                  value={formData.message_template}
                  onChange={(e) => setFormData({ ...formData, message_template: e.target.value })}
                  placeholder="Write your message here..."
                  rows="6"
                  required
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-submit">Create Message</button>
                <button type="button" className="btn-cancel" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="loading">Loading messages...</div>
        ) : (
          <div className="messages-table">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Target</th>
                  <th>Status</th>
                  <th>Recipients</th>
                  <th>Sent</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((msg) => (
                  <tr key={msg.id}>
                    <td>{msg.message_type}</td>
                    <td>{msg.target_user_type}</td>
                    <td><span className={`status ${msg.status.toLowerCase()}`}>{msg.status}</span></td>
                    <td>{msg.total_recipients}</td>
                    <td>{msg.sent_count || 0}</td>
                    <td>
                      {(msg.status === 'DRAFT' || msg.status === 'QUEUED') && (
                        <button className="btn-small" onClick={() => handleSend(msg.id)}>Send</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {messages.length === 0 && <p className="empty">No bulk messages yet</p>}
          </div>
        )}
      </div>
    </div>
  );
}
