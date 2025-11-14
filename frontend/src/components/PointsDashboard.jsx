import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/authContext';
import { pointsAPI } from '../services/api';
import '../styles/pointsDashboard.css';

export default function PointsDashboard() {
  const { user } = useAuth();
  const [pointsData, setPointsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tier thresholds and information
  const TIERS = {
    BRONZE: { min: 0, max: 1000, color: '#CD7F32', icon: '🥉' },
    SILVER: { min: 1001, max: 5000, color: '#C0C0C0', icon: '🥈' },
    GOLD: { min: 5001, max: 15000, color: '#FFD700', icon: '🥇' },
    PLATINUM: { min: 15001, max: Infinity, color: '#E5E4E2', icon: '💎' }
  };

  useEffect(() => {
    if (user?.id) {
      fetchPointsData();
    }
  }, [user?.id]);

  const fetchPointsData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await pointsAPI.getUserPoints(user.id);
      setPointsData(response.data);
    } catch (err) {
      console.error('Error fetching points data:', err);
      setError('Failed to load points data');
      // Set mock data for demonstration if API fails
      setPointsData({
        current_balance: 2500,
        lifetime_points: 5000,
        tier_level: 'SILVER',
        tier_expiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        active_campaigns: [
          { id: 1, name: 'Spring Promotion', multiplier: 1.5, expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() },
          { id: 2, name: 'Referral Bonus', multiplier: 2, expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() }
        ],
        rewards_redeemed: 3
      });
    } finally {
      setLoading(false);
    }
  };

  const getTierInfo = (tierLevel) => {
    return TIERS[tierLevel] || TIERS.BRONZE;
  };

  const getProgressToNextTier = (currentPoints, tierLevel) => {
    const currentTier = TIERS[tierLevel];
    const tierLevels = Object.keys(TIERS);
    const currentIndex = tierLevels.indexOf(tierLevel);

    if (currentIndex >= tierLevels.length - 1) {
      return 100; // Already at max tier
    }

    const nextTierLevel = tierLevels[currentIndex + 1];
    const nextTier = TIERS[nextTierLevel];

    const pointsInCurrentTier = currentPoints - currentTier.min;
    const pointsForTier = nextTier.min - currentTier.min;

    return Math.min(100, (pointsInCurrentTier / pointsForTier) * 100);
  };

  const getPointsToNextTier = (currentPoints, tierLevel) => {
    const tierLevels = Object.keys(TIERS);
    const currentIndex = tierLevels.indexOf(tierLevel);

    if (currentIndex >= tierLevels.length - 1) {
      return 0; // Already at max tier
    }

    const nextTierLevel = tierLevels[currentIndex + 1];
    const nextTier = TIERS[nextTierLevel];

    return Math.max(0, nextTier.min - currentPoints);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="points-dashboard loading">
        <p>Loading points data...</p>
      </div>
    );
  }

  if (!pointsData) {
    return (
      <div className="points-dashboard error">
        <p>{error || 'Unable to load points data'}</p>
        <button onClick={fetchPointsData} className="btn-retry">
          Retry
        </button>
      </div>
    );
  }

  const tierInfo = getTierInfo(pointsData.tier_level);
  const progressPercent = getProgressToNextTier(pointsData.current_balance, pointsData.tier_level);
  const pointsNeeded = getPointsToNextTier(pointsData.current_balance, pointsData.tier_level);

  return (
    <div className="points-dashboard">
      {/* Points Balance Card */}
      <div className="points-card balance-card">
        <div className="card-header">
          <h3>💰 Points Balance</h3>
        </div>
        <div className="balance-content">
          <div className="balance-amount">
            <p className="balance-label">Current Points</p>
            <p className="balance-value">{pointsData.current_balance.toLocaleString()}</p>
          </div>
          <div className="balance-stats">
            <p className="stat-item">
              <span className="stat-label">Lifetime:</span>
              <span className="stat-value">{pointsData.lifetime_points.toLocaleString()}</span>
            </p>
            <p className="stat-item">
              <span className="stat-label">Rewards Redeemed:</span>
              <span className="stat-value">{pointsData.rewards_redeemed || 0}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Tier Progress Card */}
      <div className="points-card tier-card">
        <div className="card-header">
          <h3>🏆 Tier Progress</h3>
        </div>
        <div className="tier-content">
          <div className="tier-display">
            <div className="tier-icon" style={{ fontSize: '48px' }}>
              {tierInfo.icon}
            </div>
            <div className="tier-info">
              <p className="tier-level">{pointsData.tier_level}</p>
              <p className="tier-expiry">
                Expires: {formatDate(pointsData.tier_expiration)}
              </p>
            </div>
          </div>

          {pointsNeeded > 0 ? (
            <div className="tier-progress">
              <p className="progress-label">
                {pointsNeeded.toLocaleString()} points to next tier
              </p>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundColor: tierInfo.color
                  }}
                />
              </div>
              <p className="progress-percent">{Math.round(progressPercent)}% progress</p>
            </div>
          ) : (
            <div className="tier-max">
              <p>🎉 You've reached the maximum tier!</p>
            </div>
          )}
        </div>
      </div>

      {/* Active Campaigns Card */}
      {pointsData.active_campaigns && pointsData.active_campaigns.length > 0 ? (
        <div className="points-card campaigns-card">
          <div className="card-header">
            <h3>🎯 Active Campaigns</h3>
          </div>
          <div className="campaigns-content">
            {pointsData.active_campaigns.map((campaign) => (
              <div key={campaign.id} className="campaign-item">
                <div className="campaign-info">
                  <p className="campaign-name">{campaign.name}</p>
                  <p className="campaign-expiry">
                    Expires: {formatDate(campaign.expires_at)}
                  </p>
                </div>
                <div className="campaign-multiplier">
                  <span className="multiplier-badge">
                    {campaign.multiplier}x
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="points-card campaigns-card empty">
          <div className="card-header">
            <h3>🎯 Active Campaigns</h3>
          </div>
          <div className="empty-state">
            <p>No active campaigns at the moment</p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="points-actions">
        <button
          className="btn-action btn-history"
          onClick={() => window.location.href = '/points/history'}
        >
          📊 View History
        </button>
        <button
          className="btn-action btn-rewards"
          onClick={() => window.location.href = '/rewards'}
        >
          🎁 Redeem Rewards
        </button>
        <button
          className="btn-action btn-leaderboard"
          onClick={() => window.location.href = '/leaderboard'}
        >
          🏅 Leaderboard
        </button>
      </div>
    </div>
  );
}
