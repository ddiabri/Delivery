import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { campaignAPI } from '../services/api';
import '../styles/adminCampaign.css';

export default function AdminCampaignPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('campaigns');
  const [campaigns, setCampaigns] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const CAMPAIGN_TYPES = ['BONUS', 'MULTIPLIER', 'REFERRAL', 'SEASONAL', 'VIP', 'EVENT'];
  const REWARD_TYPES = ['DISCOUNT', 'CREDIT', 'BADGE', 'ACCESS', 'FREE_DELIVERY'];

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [user?.role]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (activeTab === 'campaigns') {
        const response = await campaignAPI.getAllCampaigns();
        setCampaigns(response.data.campaigns || []);
      } else {
        const response = await campaignAPI.getAllRewards();
        setRewards(response.data.rewards || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
      // Mock data for demonstration
      if (activeTab === 'campaigns') {
        setCampaigns([
          {
            id: 1,
            name: 'Spring Promotion',
            type: 'BONUS',
            description: 'Spring delivery bonus campaign',
            active: true,
            multiplier: 1.5,
            starts_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: 2,
            name: 'Referral Promo',
            type: 'REFERRAL',
            description: 'Get bonuses for referrals',
            active: true,
            multiplier: 2,
            starts_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
          }
        ]);
      } else {
        setRewards([
          {
            id: 1,
            name: '10% Discount',
            type: 'DISCOUNT',
            points_cost: 500,
            value: '10%',
            available: true,
            quantity_available: 50
          },
          {
            id: 2,
            name: 'Free Delivery',
            type: 'FREE_DELIVERY',
            points_cost: 1000,
            value: '1 delivery',
            available: true,
            quantity_available: 100
          }
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async (formData) => {
    try {
      await campaignAPI.createCampaign(formData);
      setShowCreateModal(false);
      await fetchData();
    } catch (err) {
      alert('Failed to create campaign: ' + err.message);
    }
  };

  const handleDeleteCampaign = async (campaignId) => {
    if (!window.confirm('Are you sure you want to delete this campaign?')) return;

    try {
      await campaignAPI.deleteCampaign(campaignId);
      await fetchData();
    } catch (err) {
      alert('Failed to delete campaign: ' + err.message);
    }
  };

  const handleToggleCampaignStatus = async (campaignId, currentStatus) => {
    try {
      await campaignAPI.updateCampaign(campaignId, { active: !currentStatus });
      await fetchData();
    } catch (err) {
      alert('Failed to update campaign: ' + err.message);
    }
  };

  const handleCreateReward = async (formData) => {
    try {
      await campaignAPI.createReward(formData);
      setShowCreateModal(false);
      await fetchData();
    } catch (err) {
      alert('Failed to create reward: ' + err.message);
    }
  };

  const handleDeleteReward = async (rewardId) => {
    if (!window.confirm('Are you sure you want to delete this reward?')) return;

    try {
      await campaignAPI.deleteReward(rewardId);
      await fetchData();
    } catch (err) {
      alert('Failed to delete reward: ' + err.message);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="admin-campaign-page">
      <header className="admin-header">
        <h1>⚙️ Campaign Management</h1>
        <button
          className="btn-back"
          onClick={() => navigate('/dashboard')}
        >
          ← Back
        </button>
      </header>

      <main className="admin-container">
        {/* Tab Navigation */}
        <div className="tab-navigation">
          <button
            className={`tab-btn ${activeTab === 'campaigns' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('campaigns');
              fetchData();
            }}
          >
            🎯 Campaigns
          </button>
          <button
            className={`tab-btn ${activeTab === 'rewards' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('rewards');
              fetchData();
            }}
          >
            🎁 Rewards
          </button>
        </div>

        {loading ? (
          <div className="loading">Loading...</div>
        ) : error ? (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={fetchData}>Retry</button>
          </div>
        ) : activeTab === 'campaigns' ? (
          <>
            <div className="section-header">
              <h2>Marketing Campaigns</h2>
              <button
                className="btn-create"
                onClick={() => setShowCreateModal(true)}
              >
                + Create Campaign
              </button>
            </div>

            {campaigns.length > 0 ? (
              <div className="items-grid">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="item-card campaign-card">
                    <div className="card-header">
                      <h3>{campaign.name}</h3>
                      <span className={`status-badge ${campaign.active ? 'active' : 'inactive'}`}>
                        {campaign.active ? '✓ Active' : '✕ Inactive'}
                      </span>
                    </div>

                    <div className="card-content">
                      <p className="campaign-type">{campaign.type}</p>
                      <p className="campaign-description">{campaign.description}</p>

                      <div className="campaign-details">
                        <div className="detail-item">
                          <span className="label">Multiplier:</span>
                          <span className="value">{campaign.multiplier}x</span>
                        </div>
                        <div className="detail-item">
                          <span className="label">Starts:</span>
                          <span className="value">{formatDate(campaign.starts_at)}</span>
                        </div>
                        <div className="detail-item">
                          <span className="label">Expires:</span>
                          <span className="value">{formatDate(campaign.expires_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="card-actions">
                      <button
                        className="btn-action btn-toggle"
                        onClick={() => handleToggleCampaignStatus(campaign.id, campaign.active)}
                      >
                        {campaign.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        className="btn-action btn-edit"
                        onClick={() => setEditingItem(campaign)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-action btn-delete"
                        onClick={() => handleDeleteCampaign(campaign.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No campaigns created yet</p>
                <button
                  className="btn-create"
                  onClick={() => setShowCreateModal(true)}
                >
                  Create First Campaign
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="section-header">
              <h2>Rewards Catalog</h2>
              <button
                className="btn-create"
                onClick={() => setShowCreateModal(true)}
              >
                + Create Reward
              </button>
            </div>

            {rewards.length > 0 ? (
              <div className="items-grid">
                {rewards.map((reward) => (
                  <div key={reward.id} className="item-card reward-card">
                    <div className="card-header">
                      <h3>{reward.name}</h3>
                      <span className={`type-badge ${reward.type.toLowerCase()}`}>
                        {reward.type}
                      </span>
                    </div>

                    <div className="card-content">
                      <p className="reward-value">{reward.value}</p>

                      <div className="reward-details">
                        <div className="detail-item">
                          <span className="label">Points Cost:</span>
                          <span className="value">{reward.points_cost}</span>
                        </div>
                        <div className="detail-item">
                          <span className="label">Available:</span>
                          <span className="value">
                            {reward.quantity_available
                              ? `${reward.quantity_available} remaining`
                              : 'Unlimited'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="card-actions">
                      <button
                        className="btn-action btn-edit"
                        onClick={() => setEditingItem(reward)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-action btn-delete"
                        onClick={() => handleDeleteReward(reward.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No rewards created yet</p>
                <button
                  className="btn-create"
                  onClick={() => setShowCreateModal(true)}
                >
                  Create First Reward
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <CampaignModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={activeTab === 'campaigns' ? handleCreateCampaign : handleCreateReward}
          campaignTypes={CAMPAIGN_TYPES}
          rewardTypes={REWARD_TYPES}
          tabType={activeTab}
        />
      )}

      {editingItem && (
        <div className="modal-overlay" onClick={() => setEditingItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Edit {editingItem.name}</h3>
            <p>Edit functionality coming soon</p>
            <button onClick={() => setEditingItem(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Campaign Modal Component
function CampaignModal({ isOpen, onClose, onSubmit, campaignTypes, rewardTypes, tabType }) {
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    description: '',
    multiplier: 1,
    pointsCost: '',
    value: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{tabType === 'campaigns' ? 'Create Campaign' : 'Create Reward'}</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter name"
              required
            />
          </div>

          <div className="form-group">
            <label>Type *</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              required
            >
              <option value="">Select type</option>
              {(tabType === 'campaigns' ? campaignTypes : rewardTypes).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {tabType === 'campaigns' ? (
            <>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Enter description"
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label>Multiplier</label>
                <input
                  type="number"
                  name="multiplier"
                  value={formData.multiplier}
                  onChange={handleChange}
                  step="0.1"
                  min="1"
                />
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label>Points Cost *</label>
                <input
                  type="number"
                  name="pointsCost"
                  value={formData.pointsCost}
                  onChange={handleChange}
                  placeholder="Enter points cost"
                  required
                />
              </div>

              <div className="form-group">
                <label>Value/Description *</label>
                <input
                  type="text"
                  name="value"
                  value={formData.value}
                  onChange={handleChange}
                  placeholder="Enter reward value"
                  required
                />
              </div>
            </>
          )}

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-submit">
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
