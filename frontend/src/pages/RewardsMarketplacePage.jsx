import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { pointsAPI } from '../services/api';
import '../styles/rewardsMarketplace.css';

export default function RewardsMarketplacePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [userPoints, setUserPoints] = useState(0);
  const [rewards, setRewards] = useState([]);
  const [filteredRewards, setFilteredRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [redeemingId, setRedeemingId] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const REWARD_TYPES = {
    DISCOUNT: { label: 'Discount', icon: '🏷️', color: '#2196f3' },
    CREDIT: { label: 'Credit', icon: '💳', color: '#4caf50' },
    BADGE: { label: 'Badge', icon: '🏅', color: '#ff9800' },
    ACCESS: { label: 'Access', icon: '🔓', color: '#9c27b0' },
    FREE_DELIVERY: { label: 'Free Delivery', icon: '🚚', color: '#f44336' }
  };

  useEffect(() => {
    if (user?.id) {
      fetchData();
    } else {
      navigate('/login');
    }
  }, [user?.id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch user points
      const pointsResponse = await pointsAPI.getUserPoints(user.id);
      setUserPoints(pointsResponse.data.current_balance);

      // Fetch available rewards
      const rewardsResponse = await pointsAPI.getAvailableRewards(user.id);
      setRewards(rewardsResponse.data.rewards || []);
      setFilteredRewards(rewardsResponse.data.rewards || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load rewards');
      // Mock data for demonstration
      setUserPoints(5000);
      const mockRewards = [
        {
          id: 1,
          name: '10% Delivery Discount',
          type: 'DISCOUNT',
          points_cost: 500,
          description: 'Get 10% off on your next 5 deliveries',
          quantity_available: 50,
          is_limited: true
        },
        {
          id: 2,
          name: '5 Free Deliveries',
          type: 'FREE_DELIVERY',
          points_cost: 2000,
          description: 'Enjoy 5 completely free deliveries',
          quantity_available: 10,
          is_limited: true
        },
        {
          id: 3,
          name: 'Premium Badge',
          type: 'BADGE',
          points_cost: 1000,
          description: 'Display a Premium member badge',
          quantity_available: null,
          is_limited: false
        },
        {
          id: 4,
          name: 'VIP Member Access',
          type: 'ACCESS',
          points_cost: 3000,
          description: 'Get VIP status for 3 months',
          quantity_available: 20,
          is_limited: true
        },
        {
          id: 5,
          name: '₱500 Store Credit',
          type: 'CREDIT',
          points_cost: 1500,
          description: 'Use ₱500 credit for future purchases',
          quantity_available: 100,
          is_limited: true
        },
        {
          id: 6,
          name: 'Express Delivery Badge',
          type: 'BADGE',
          points_cost: 800,
          description: 'Show you prefer fast deliveries',
          quantity_available: null,
          is_limited: false
        }
      ];
      setRewards(mockRewards);
      setFilteredRewards(mockRewards);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    if (category === 'ALL') {
      setFilteredRewards(rewards);
    } else {
      setFilteredRewards(rewards.filter((r) => r.type === category));
    }
  };

  const handleRedeemReward = async (rewardId) => {
    if (!user?.id) return;

    try {
      setRedeemingId(rewardId);
      const response = await pointsAPI.redeemReward(user.id, rewardId);

      // Update user points
      setUserPoints(response.data.new_balance);

      // Show success message
      setSuccessMessage(`Successfully redeemed reward! Reference: ${response.data.reference_code}`);

      // Refresh rewards
      await fetchData();

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      console.error('Error redeeming reward:', err);
      if (err.response?.status === 400) {
        alert('Not enough points to redeem this reward');
      } else if (err.response?.status === 409) {
        alert('This reward is out of stock');
      } else {
        alert('Failed to redeem reward. Please try again.');
      }
    } finally {
      setRedeemingId(null);
    }
  };

  const getRewardTypeInfo = (type) => {
    return REWARD_TYPES[type] || { label: 'Reward', icon: '🎁', color: '#999' };
  };

  const isAffordable = (cost) => userPoints >= cost;

  if (loading) {
    return (
      <div className="rewards-page">
        <header className="page-header">
          <h1>🎁 Rewards Marketplace</h1>
        </header>
        <div className="loading">
          <p>Loading rewards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rewards-page">
      <header className="page-header">
        <div className="header-content">
          <h1>🎁 Rewards Marketplace</h1>
          <button
            className="btn-back"
            onClick={() => navigate('/dashboard')}
          >
            ← Back to Dashboard
          </button>
        </div>
      </header>

      <main className="rewards-container">
        {/* User Points Summary */}
        <section className="points-summary">
          <div className="points-card">
            <p className="label">Your Points Balance</p>
            <p className="value">{userPoints.toLocaleString()}</p>
          </div>
        </section>

        {/* Success Message */}
        {successMessage && (
          <div className="success-message">
            <p>{successMessage}</p>
            <button
              className="btn-close"
              onClick={() => setSuccessMessage(null)}
            >
              ✕
            </button>
          </div>
        )}

        {/* Error Message */}
        {error && !rewards.length && (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={fetchData} className="btn-retry">
              Retry
            </button>
          </div>
        )}

        {/* Category Filter */}
        <section className="filter-section">
          <div className="filter-label">Filter by Type:</div>
          <div className="filter-buttons">
            <button
              className={`filter-btn ${selectedCategory === 'ALL' ? 'active' : ''}`}
              onClick={() => handleCategoryChange('ALL')}
            >
              All Rewards
            </button>
            {Object.entries(REWARD_TYPES).map(([key, value]) => (
              <button
                key={key}
                className={`filter-btn ${selectedCategory === key ? 'active' : ''}`}
                onClick={() => handleCategoryChange(key)}
                style={{
                  borderColor: selectedCategory === key ? value.color : '#ddd',
                  color: selectedCategory === key ? value.color : '#666'
                }}
              >
                {value.icon} {value.label}
              </button>
            ))}
          </div>
        </section>

        {/* Rewards Grid */}
        {filteredRewards.length > 0 ? (
          <section className="rewards-grid">
            {filteredRewards.map((reward) => {
              const typeInfo = getRewardTypeInfo(reward.type);
              const affordable = isAffordable(reward.points_cost);
              const outOfStock = reward.is_limited && reward.quantity_available === 0;

              return (
                <div
                  key={reward.id}
                  className={`reward-card ${!affordable ? 'unaffordable' : ''} ${outOfStock ? 'out-of-stock' : ''}`}
                >
                  <div className="reward-header">
                    <span
                      className="reward-type-badge"
                      style={{ backgroundColor: typeInfo.color }}
                    >
                      {typeInfo.icon} {typeInfo.label}
                    </span>
                  </div>

                  <div className="reward-content">
                    <h3 className="reward-name">{reward.name}</h3>
                    <p className="reward-description">{reward.description}</p>

                    {reward.is_limited && (
                      <p className="stock-info">
                        {reward.quantity_available > 0
                          ? `${reward.quantity_available} remaining`
                          : 'Out of Stock'}
                      </p>
                    )}
                  </div>

                  <div className="reward-footer">
                    <div className="points-cost">
                      <p className="cost-value">{reward.points_cost}</p>
                      <p className="cost-label">Points</p>
                    </div>

                    {outOfStock ? (
                      <button className="btn-redeem btn-disabled" disabled>
                        Out of Stock
                      </button>
                    ) : !affordable ? (
                      <button className="btn-redeem btn-disabled" disabled>
                        Not Enough Points
                      </button>
                    ) : (
                      <button
                        className="btn-redeem"
                        onClick={() => handleRedeemReward(reward.id)}
                        disabled={redeemingId === reward.id}
                      >
                        {redeemingId === reward.id ? 'Redeeming...' : 'Redeem'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        ) : (
          <div className="empty-state">
            <p className="empty-icon">🎁</p>
            <p className="empty-text">No rewards available in this category</p>
            <button
              className="btn-primary"
              onClick={() => handleCategoryChange('ALL')}
            >
              View All Rewards
            </button>
          </div>
        )}

        {/* Redeeming History Link */}
        <section className="history-section">
          <button
            className="btn-secondary"
            onClick={() => navigate('/rewards/history')}
          >
            📜 View Redemption History
          </button>
        </section>
      </main>
    </div>
  );
}
