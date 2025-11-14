import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/authContext';
import '../styles/wallet.css';

export default function WalletPage() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [packages, setPackages] = useState([]);
  const [bonuses, setBonuses] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('balance');
  const [showReloadForm, setShowReloadForm] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [customAmount, setCustomAmount] = useState('');

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      const [walletRes, packagesRes, bonusesRes, transactionsRes] = await Promise.all([
        fetch('/api/wallet', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }),
        fetch('/api/wallet/packages', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }),
        fetch('/api/wallet/bonuses', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }),
        fetch('/api/wallet/transactions', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        })
      ]);

      if (!walletRes.ok || !packagesRes.ok) throw new Error('Failed to fetch wallet data');

      const walletData = await walletRes.json();
      const packagesData = await packagesRes.json();
      const bonusesData = bonusesRes.ok ? await bonusesRes.json() : { bonuses: [] };
      const transactionsData = transactionsRes.ok ? await transactionsRes.json() : { transactions: [] };

      setWallet(walletData.wallet);
      setPackages(packagesData.packages || []);
      setBonuses(bonusesData.bonuses || []);
      setTransactions(transactionsData.transactions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReload = async (e) => {
    e.preventDefault();
    setError(null);

    if (!selectedPackage && !customAmount) {
      setError('Please select a package or enter custom amount');
      return;
    }

    const amount = selectedPackage ? selectedPackage.amount : parseFloat(customAmount);
    const bonus = selectedPackage ? selectedPackage.bonus_amount : 0;

    try {
      const response = await fetch('/api/wallet/reload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          amount,
          bonus_amount: bonus,
          description: `Wallet reload: $${amount}${bonus ? ` + $${bonus} bonus` : ''}`
        }),
      });

      if (!response.ok) throw new Error('Failed to reload wallet');

      const data = await response.json();
      setWallet({ ...wallet, balance: data.newBalance });
      setTransactions([data.transaction, ...transactions]);
      setSuccessMessage('Wallet reloaded successfully!');
      setShowReloadForm(false);
      setSelectedPackage(null);
      setCustomAmount('');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleClaimBonus = async (bonusId) => {
    try {
      const response = await fetch(`/api/wallet/bonuses/${bonusId}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      if (!response.ok) throw new Error('Failed to claim bonus');

      const data = await response.json();
      setWallet({ ...wallet, balance: data.transaction.balance_after });
      setBonuses(bonuses.filter((b) => b.id !== bonusId));
      setSuccessMessage('Bonus claimed successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const formatCurrency = (amount) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return <div className="wallet-page loading">Loading wallet...</div>;
  }

  return (
    <div className="wallet-page">
      <header className="page-header">
        <h1>💳 My Wallet</h1>
        <p>Manage your account balance and reload funds</p>
      </header>

      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      <div className="wallet-container">
        {/* Wallet Balance Card */}
        {wallet && (
          <div className="balance-card">
            <div className="balance-info">
              <h2>Available Balance</h2>
              <div className="amount">{formatCurrency(wallet.balance)}</div>
              <p className="currency">{wallet.currency}</p>
            </div>
            <div className="wallet-stats">
              <div className="stat">
                <strong>Total Loaded</strong>
                <span>{formatCurrency(wallet.total_loaded)}</span>
              </div>
              <div className="stat">
                <strong>Total Spent</strong>
                <span>{formatCurrency(wallet.total_spent)}</span>
              </div>
            </div>
            <button
              className="btn-reload"
              onClick={() => setShowReloadForm(!showReloadForm)}
            >
              {showReloadForm ? '✕ Close' : '+ Reload Wallet'}
            </button>
          </div>
        )}

        {/* Reload Form */}
        {showReloadForm && (
          <div className="reload-form-section">
            <h3>Reload Your Wallet</h3>
            <form onSubmit={handleReload}>
              <div className="packages-grid">
                <h4>Quick Top-Up Packages</h4>
                {packages.length > 0 ? (
                  packages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className={`package-card ${selectedPackage?.id === pkg.id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedPackage(pkg);
                        setCustomAmount('');
                      }}
                    >
                      <div className="package-amount">{formatCurrency(pkg.amount)}</div>
                      {pkg.bonus_amount > 0 && (
                        <div className="bonus">+{formatCurrency(pkg.bonus_amount)}</div>
                      )}
                      {pkg.description && <p>{pkg.description}</p>}
                    </div>
                  ))
                ) : (
                  <p>No packages available</p>
                )}
              </div>

              <div className="custom-amount">
                <h4>Or enter custom amount</h4>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setSelectedPackage(null);
                  }}
                  placeholder="Enter amount (e.g., 50.00)"
                />
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={!selectedPackage && !customAmount}
                >
                  Reload Now
                </button>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowReloadForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'balance' ? 'active' : ''}`}
            onClick={() => setActiveTab('balance')}
          >
            💰 Balance
          </button>
          <button
            className={`tab ${activeTab === 'bonuses' ? 'active' : ''}`}
            onClick={() => setActiveTab('bonuses')}
          >
            🎁 Bonuses {bonuses.length > 0 && `(${bonuses.length})`}
          </button>
          <button
            className={`tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            📜 History
          </button>
        </div>

        {/* Balance Tab */}
        {activeTab === 'balance' && (
          <div className="tab-content balance-tab">
            <div className="info-box">
              <h4>💡 About Your Wallet</h4>
              <ul>
                <li>Use your wallet to pay for deliveries instantly</li>
                <li>Reload anytime with various payment methods</li>
                <li>Earn bonuses on selected packages</li>
                <li>All transactions are secure and tracked</li>
              </ul>
            </div>
          </div>
        )}

        {/* Bonuses Tab */}
        {activeTab === 'bonuses' && (
          <div className="tab-content bonuses-tab">
            {bonuses.length > 0 ? (
              <div className="bonuses-list">
                {bonuses.map((bonus) => (
                  <div key={bonus.id} className="bonus-card">
                    <div className="bonus-info">
                      <h4>{bonus.bonus_type}</h4>
                      <p>{bonus.description}</p>
                      <div className="bonus-amount">{formatCurrency(bonus.amount)}</div>
                      <small>Expires: {formatDate(bonus.expires_at)}</small>
                    </div>
                    <button
                      className="btn-claim"
                      onClick={() => handleClaimBonus(bonus.id)}
                    >
                      Claim
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty">No bonuses available. Check back later!</p>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="tab-content history-tab">
            {transactions.length > 0 ? (
              <div className="transactions-list">
                {transactions.map((tx) => (
                  <div key={tx.id} className={`transaction-item ${tx.transaction_type.toLowerCase()}`}>
                    <div className="tx-icon">
                      {tx.transaction_type === 'RELOAD' && '⬇️'}
                      {tx.transaction_type === 'PAYMENT' && '⬅️'}
                      {tx.transaction_type === 'REFUND' && '↩️'}
                      {tx.transaction_type === 'BONUS' && '🎁'}
                      {tx.transaction_type === 'ADJUSTMENT' && '🔄'}
                    </div>
                    <div className="tx-info">
                      <h4>{tx.transaction_type}</h4>
                      <p>{tx.description}</p>
                      <small>{formatDate(tx.created_at)}</small>
                    </div>
                    <div className="tx-amount">
                      <span className={tx.transaction_type === 'RELOAD' || tx.transaction_type === 'BONUS' || tx.transaction_type === 'REFUND' ? 'positive' : 'negative'}>
                        {tx.transaction_type === 'RELOAD' || tx.transaction_type === 'BONUS' || tx.transaction_type === 'REFUND' ? '+' : '-'}
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty">No transaction history yet</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
