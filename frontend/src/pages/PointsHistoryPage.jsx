import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { pointsAPI } from '../services/api';
import '../styles/pointsHistory.css';

export default function PointsHistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    offset: 0,
    limit: 20,
    hasMore: true
  });
  const [selectedFilter, setSelectedFilter] = useState('ALL');

  const ACTION_TYPES = {
    DELIVERY_COMPLETED: { label: 'Delivery Completed', icon: '✅', color: '#4caf50' },
    ON_TIME: { label: 'On Time Bonus', icon: '⏱️', color: '#2196f3' },
    RATING: { label: 'Rating Bonus', icon: '⭐', color: '#ff9800' },
    REFERRAL: { label: 'Referral Bonus', icon: '👥', color: '#9c27b0' },
    REWARD_REDEEMED: { label: 'Reward Redeemed', icon: '🎁', color: '#f44336' },
    SIGNUP_BONUS: { label: 'Sign Up Bonus', icon: '🎉', color: '#00bcd4' },
    MANUAL_ADJUSTMENT: { label: 'Manual Adjustment', icon: '⚙️', color: '#666' }
  };

  useEffect(() => {
    if (user?.id) {
      fetchTransactions(0);
    } else {
      navigate('/login');
    }
  }, [user?.id]);

  const fetchTransactions = async (offset = 0) => {
    try {
      setLoading(true);
      setError(null);
      const response = await pointsAPI.getUserPointsHistory(user.id, pagination.limit, offset);

      if (offset === 0) {
        setTransactions(response.data.transactions || []);
      } else {
        setTransactions([...transactions, ...(response.data.transactions || [])]);
      }

      setPagination({
        offset: offset + pagination.limit,
        limit: pagination.limit,
        hasMore: response.data.has_more ?? false
      });
    } catch (err) {
      console.error('Error fetching transactions:', err);
      if (offset === 0) {
        setError('Failed to load transaction history');
        // Mock data for demonstration
        const mockTransactions = [
          {
            id: 1,
            action_type: 'DELIVERY_COMPLETED',
            points_earned: 100,
            points_spent: 0,
            multiplier_applied: 1,
            delivery_id: 'DEL001',
            campaign_name: 'Daily Deliveries',
            created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: 2,
            action_type: 'ON_TIME',
            points_earned: 50,
            points_spent: 0,
            multiplier_applied: 1,
            delivery_id: 'DEL001',
            campaign_name: 'On-Time Delivery',
            created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: 3,
            action_type: 'REWARD_REDEEMED',
            points_earned: 0,
            points_spent: 500,
            multiplier_applied: 1,
            campaign_name: null,
            created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: 4,
            action_type: 'SIGNUP_BONUS',
            points_earned: 200,
            points_spent: 0,
            multiplier_applied: 1,
            campaign_name: 'Welcome Bonus',
            created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: 5,
            action_type: 'REFERRAL',
            points_earned: 300,
            points_spent: 0,
            multiplier_applied: 1.5,
            campaign_name: 'Referral Promo',
            created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
          }
        ];
        setTransactions(mockTransactions);
        setPagination({
          offset: pagination.limit,
          limit: pagination.limit,
          hasMore: false
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    fetchTransactions(pagination.offset);
  };

  const filterTransactions = () => {
    if (selectedFilter === 'ALL') {
      return transactions;
    }

    if (selectedFilter === 'EARNED') {
      return transactions.filter(t => t.points_earned > 0);
    }

    if (selectedFilter === 'SPENT') {
      return transactions.filter(t => t.points_spent > 0);
    }

    return transactions.filter(t => t.action_type === selectedFilter);
  };

  const getActionTypeInfo = (actionType) => {
    return ACTION_TYPES[actionType] || { label: actionType, icon: '📝', color: '#999' };
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const filteredTransactions = filterTransactions();

  return (
    <div className="points-history-page">
      <header className="page-header">
        <div className="header-content">
          <h1>📊 Points History</h1>
          <button
            className="btn-back"
            onClick={() => navigate('/dashboard')}
          >
            ← Back
          </button>
        </div>
      </header>

      <main className="history-container">
        {/* Filter Section */}
        <section className="filter-section">
          <div className="filter-label">Filter:</div>
          <div className="filter-tabs">
            <button
              className={`filter-tab ${selectedFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setSelectedFilter('ALL')}
            >
              All Transactions
            </button>
            <button
              className={`filter-tab ${selectedFilter === 'EARNED' ? 'active' : ''}`}
              onClick={() => setSelectedFilter('EARNED')}
            >
              Points Earned
            </button>
            <button
              className={`filter-tab ${selectedFilter === 'SPENT' ? 'active' : ''}`}
              onClick={() => setSelectedFilter('SPENT')}
            >
              Points Spent
            </button>
          </div>
        </section>

        {loading && transactions.length === 0 ? (
          <div className="loading">
            <p>Loading transaction history...</p>
          </div>
        ) : error && transactions.length === 0 ? (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={() => fetchTransactions(0)} className="btn-retry">
              Retry
            </button>
          </div>
        ) : filteredTransactions.length > 0 ? (
          <>
            <section className="transactions-list">
              {filteredTransactions.map((transaction) => {
                const actionInfo = getActionTypeInfo(transaction.action_type);
                const isEarning = transaction.points_earned > 0;

                return (
                  <div key={transaction.id} className="transaction-item">
                    <div className="transaction-left">
                      <div
                        className="action-icon"
                        style={{ backgroundColor: actionInfo.color }}
                      >
                        {actionInfo.icon}
                      </div>
                      <div className="transaction-info">
                        <h4 className="action-type">{actionInfo.label}</h4>
                        {transaction.campaign_name && (
                          <p className="campaign-name">{transaction.campaign_name}</p>
                        )}
                        {transaction.delivery_id && (
                          <p className="delivery-id">Delivery: {transaction.delivery_id}</p>
                        )}
                        <p className="transaction-date">{formatDate(transaction.created_at)}</p>
                      </div>
                    </div>

                    <div className="transaction-right">
                      <div className="points-display">
                        {isEarning ? (
                          <div className="points-earned">
                            <span className="points-sign">+</span>
                            <span className="points-amount">
                              {transaction.points_earned}
                            </span>
                            {transaction.multiplier_applied > 1 && (
                              <span className="multiplier">
                                ×{transaction.multiplier_applied}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="points-spent">
                            <span className="points-sign">−</span>
                            <span className="points-amount">
                              {transaction.points_spent}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>

            {pagination.hasMore && (
              <div className="load-more-section">
                <button
                  className="btn-load-more"
                  onClick={handleLoadMore}
                  disabled={loading}
                >
                  {loading ? 'Loading...' : 'Load More Transactions'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <p className="empty-icon">📭</p>
            <p className="empty-text">No transaction history</p>
            <p className="empty-subtext">
              {selectedFilter === 'EARNED'
                ? 'Start earning points by completing deliveries!'
                : selectedFilter === 'SPENT'
                ? 'You haven\'t redeemed any rewards yet'
                : 'Your transaction history will appear here'}
            </p>
            <button
              className="btn-primary"
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
