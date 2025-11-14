import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/authContext';
import '../styles/adminPages.css';

export default function AdminPromotionBannersPage() {
  const { user } = useAuth();
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    banner_type: 'ANNOUNCEMENT',
    target_user_type: 'ALL',
    priority: 0,
    start_date: '',
    end_date: '',
    call_to_action_text: '',
    call_to_action_link: '',
    background_color: '#667eea',
    text_color: '#ffffff',
  });

  useEffect(() => {
    if (user?.role !== 'admin') {
      setError('Access denied. Admin only.');
      return;
    }
    fetchBanners();
  }, [user]);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/banners/admin/all', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error('Failed to fetch banners');
      const data = await response.json();
      setBanners(data.banners);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/banners', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error('Failed to create banner');
      const data = await response.json();
      setBanners([data.banner, ...banners]);
      setSuccessMessage('Banner created!');
      setShowForm(false);
      setFormData({
        title: '', description: '', banner_type: 'ANNOUNCEMENT', target_user_type: 'ALL',
        priority: 0, start_date: '', end_date: '', call_to_action_text: '', call_to_action_link: '',
        background_color: '#667eea', text_color: '#ffffff',
      });
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this banner?')) return;
    try {
      const response = await fetch(`/api/banners/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error('Failed to delete banner');
      setBanners(banners.filter((b) => b.id !== id));
      setSuccessMessage('Banner deleted!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleActive = async (id, isActive) => {
    try {
      const response = await fetch(`/api/banners/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ is_active: !isActive }),
      });
      if (!response.ok) throw new Error('Failed to update banner');
      fetchBanners();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="admin-page">
      <header className="page-header">
        <h1>📢 Promotion Banners</h1>
        <p>Create and manage in-app promotional banners</p>
      </header>

      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      <div className="admin-container">
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Close' : '+ New Banner'}
        </button>

        {showForm && (
          <div className="form-section">
            <h2>Create Promotion Banner</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Banner title"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Banner Type *</label>
                  <select value={formData.banner_type} onChange={(e) => setFormData({ ...formData, banner_type: e.target.value })} required>
                    <option value="ANNOUNCEMENT">Announcement</option>
                    <option value="DISCOUNT">Discount</option>
                    <option value="POINTS_BONUS">Points Bonus</option>
                    <option value="FREE_DELIVERY">Free Delivery</option>
                    <option value="NEW_FEATURE">New Feature</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Banner description"
                  rows="3"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Target Users *</label>
                  <select value={formData.target_user_type} onChange={(e) => setFormData({ ...formData, target_user_type: e.target.value })} required>
                    <option value="ALL">All Users</option>
                    <option value="CUSTOMER">Customers</option>
                    <option value="DRIVER">Drivers</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Priority</label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Start Date *</label>
                  <input
                    type="datetime-local"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>End Date *</label>
                  <input
                    type="datetime-local"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>CTA Text</label>
                  <input
                    type="text"
                    value={formData.call_to_action_text}
                    onChange={(e) => setFormData({ ...formData, call_to_action_text: e.target.value })}
                    placeholder="e.g., Learn More"
                  />
                </div>
                <div className="form-group">
                  <label>CTA Link</label>
                  <input
                    type="text"
                    value={formData.call_to_action_link}
                    onChange={(e) => setFormData({ ...formData, call_to_action_link: e.target.value })}
                    placeholder="/path/to/page"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-submit">Create Banner</button>
                <button type="button" className="btn-cancel" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="loading">Loading banners...</div>
        ) : (
          <div className="banners-grid">
            {banners.map((banner) => (
              <div key={banner.id} className="banner-card">
                <div className="banner-preview" style={{ backgroundColor: banner.background_color, color: banner.text_color }}>
                  <h3>{banner.title}</h3>
                  <p>{banner.description}</p>
                </div>
                <div className="banner-info">
                  <p><strong>Type:</strong> {banner.banner_type}</p>
                  <p><strong>Target:</strong> {banner.target_user_type}</p>
                  <p><strong>Status:</strong> {banner.is_active ? '✓ Active' : '✗ Inactive'}</p>
                </div>
                <div className="banner-actions">
                  <button className="btn-small" onClick={() => toggleActive(banner.id, banner.is_active)}>
                    {banner.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button className="btn-small btn-danger" onClick={() => handleDelete(banner.id)}>Delete</button>
                </div>
              </div>
            ))}
            {banners.length === 0 && <p className="empty">No banners created yet</p>}
          </div>
        )}
      </div>
    </div>
  );
}
