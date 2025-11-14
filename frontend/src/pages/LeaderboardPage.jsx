import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { pointsAPI } from '../services/api';
import '../styles/leaderboard.css';

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState('customers');
  const [leaderboard, setLeaderboard] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const TIER_COLORS = {
    BRONZE: '#CD7F32',
    SILVER: '#C0C0C0',
    GOLD: '#FFD700',
    PLATINUM: '#E5E4E2'
  };

  const TIER_ICONS = {
    BRONZE: '🥉',
    SILVER: '🥈',
    GOLD: '🥇',
    PLATINUM: '💎'
  };

  const MEDAL_ICONS = ['🥇', '🥈', '🥉'];

  useEffect(() => {
    fetchLeaderboard();
  }, [selectedType]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await pointsAPI.getLeaderboards(selectedType);

      const leaderboardData = response.data.leaderboard || [];
      setLeaderboard(leaderboardData);

      // Find user's rank in leaderboard
      if (user?.id) {
        const userIndex = leaderboardData.findIndex((entry) => entry.user_id === user.id);
        if (userIndex !== -1) {
          setUserRank({
            position: userIndex + 1,
            ...leaderboardData[userIndex]
          });
        }
      }
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setError('Failed to load leaderboard');

      // Mock data for demonstration
      const mockData = [
        {
          position: 1,
          user_id: '1',
          user_name: 'John Driver',
          current_balance: 15500,
          tier_level: 'PLATINUM',
          rank_badge: '🏆'
        },
        {
          position: 2,
          user_id: '2',
          user_name: 'Sarah Delivery',
          current_balance: 12300,
          tier_level: 'GOLD',
          rank_badge: '⭐'
        },
        {
          position: 3,
          user_id: '3',
          user_name: 'Mike Express',
          current_balance: 8900,
          tier_level: 'GOLD',
          rank_badge: '✨'
        },
        {
          position: 4,
          user_id: '4',
          user_name: 'Lisa Fast',
          current_balance: 6200,
          tier_level: 'SILVER',
          rank_badge: ''
        },
        {
          position: 5,
          user_id: '5',
          user_name: 'Tom Quick',
          current_balance: 4100,
          tier_level: 'SILVER',
          rank_badge: ''
        }
      ];

      setLeaderboard(mockData);

      // Mock user rank
      if (user?.id === '4') {
        setUserRank({
          position: 4,
          user_id: '4',
          user_name: user.full_name,
          current_balance: 6200,
          tier_level: 'SILVER'
        });
      } else {
        setUserRank({
          position: 8,
          user_id: user?.id,
          user_name: user?.full_name,
          current_balance: 2500,
          tier_level: 'BRONZE'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const getRankMedal = (position) => {
    if (position <= 3) {
      return MEDAL_ICONS[position - 1];
    }
    return `#${position}`;
  };

  const isCurrentUser = (userId) => user?.id === userId;

  return (
    <div className="leaderboard-page">
      <header className="page-header">
        <div className="header-content">
          <h1>🏆 Leaderboard</h1>
          <button
            className="btn-back"
            onClick={() => navigate('/dashboard')}
          >
            ← Back
          </button>
        </div>
      </header>

      <main className="leaderboard-container">
        {/* Type Selector */}
        <section className="type-selector">
          <button
            className={`type-btn ${selectedType === 'customers' ? 'active' : ''}`}
            onClick={() => setSelectedType('customers')}
          >
            👥 Customers
          </button>
          <button
            className={`type-btn ${selectedType === 'drivers' ? 'active' : ''}`}
            onClick={() => setSelectedType('drivers')}
          >
            🚗 Drivers
          </button>
        </section>

        {loading ? (
          <div className="loading">
            <p>Loading leaderboard...</p>
          </div>
        ) : error && leaderboard.length === 0 ? (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={fetchLeaderboard} className="btn-retry">
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* User's Current Rank (if found) */}
            {userRank && (
              <section className="user-rank-section">
                <div className="user-rank-card">
                  <div className="rank-position">
                    <span className="position-number">{getRankMedal(userRank.position)}</span>
                    <span className="position-label">Your Position</span>
                  </div>
                  <div className="rank-info">
                    <h3 className="rank-name">{userRank.user_name}</h3>
                    <p className="rank-tier">
                      {TIER_ICONS[userRank.tier_level]} {userRank.tier_level}
                    </p>
                  </div>
                  <div className="rank-points">
                    <p className="points-label">Points</p>
                    <p className="points-value">{userRank.current_balance.toLocaleString()}</p>
                  </div>
                </div>
              </section>
            )}

            {/* Top Rankings */}
            <section className="top-rankings">
              <h2>Top {selectedType === 'customers' ? 'Customers' : 'Drivers'}</h2>

              {leaderboard.length > 0 ? (
                <div className="rankings-list">
                  {leaderboard.map((entry, index) => {
                    const isCurrent = isCurrentUser(entry.user_id);
                    return (
                      <div
                        key={entry.user_id}
                        className={`ranking-item ${isCurrent ? 'current-user' : ''} ${
                          index < 3 ? 'top-three' : ''
                        }`}
                      >
                        <div className="ranking-position">
                          <div className={`medal medal-${index + 1}`}>
                            {getRankMedal(index + 1)}
                          </div>
                        </div>

                        <div className="ranking-info">
                          <h4 className="ranking-name">
                            {entry.user_name}
                            {isCurrent && <span className="current-badge">(You)</span>}
                          </h4>
                          <p className="ranking-tier">
                            {TIER_ICONS[entry.tier_level] || '📊'} {entry.tier_level}
                          </p>
                        </div>

                        <div className="ranking-points">
                          <p className="points-value">{entry.current_balance.toLocaleString()}</p>
                          <p className="points-label">points</p>
                        </div>

                        {index < 3 && (
                          <div className="ranking-trophy">
                            {TIER_ICONS[entry.tier_level]}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <p className="empty-icon">📭</p>
                  <p className="empty-text">No leaderboard data available</p>
                </div>
              )}
            </section>

            {/* Leaderboard Info */}
            <section className="leaderboard-info">
              <div className="info-card">
                <h3>How does it work?</h3>
                <ul>
                  <li>🎯 Earn points by completing deliveries</li>
                  <li>⚡ Bonus multipliers from active campaigns</li>
                  <li>🏆 Rank higher by accumulating more points</li>
                  <li>🎁 Redeem points for exclusive rewards</li>
                </ul>
              </div>

              <div className="info-card">
                <h3>Tier System</h3>
                <div className="tier-list">
                  <div className="tier-item">
                    <span className="tier-badge">🥉 BRONZE</span>
                    <span className="tier-range">0 - 1,000 points</span>
                  </div>
                  <div className="tier-item">
                    <span className="tier-badge">🥈 SILVER</span>
                    <span className="tier-range">1,001 - 5,000 points</span>
                  </div>
                  <div className="tier-item">
                    <span className="tier-badge">🥇 GOLD</span>
                    <span className="tier-range">5,001 - 15,000 points</span>
                  </div>
                  <div className="tier-item">
                    <span className="tier-badge">💎 PLATINUM</span>
                    <span className="tier-range">15,001+ points</span>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
