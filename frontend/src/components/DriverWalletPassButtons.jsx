import React, { useState, useEffect } from 'react';
import '../styles/driverWalletPassButtons.css';

export default function DriverWalletPassButtons({ driverId }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [config, setConfig] = useState(null);

  // Fetch wallet pass configuration on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/driver-wallet-pass/config');
        const data = await response.json();
        setConfig(data);
      } catch (err) {
        console.error('Error fetching wallet config:', err);
      }
    };

    fetchConfig();
  }, []);

  /**
   * Download Apple Wallet pass
   */
  const handleAppleWalletClick = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Fetch the .pkpass file
      const response = await fetch(
        `/api/driver-wallet-pass/apple/${driverId}`
      );

      if (!response.ok) {
        throw new Error('Failed to download Apple Wallet pass');
      }

      // Create blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'DriverPass.pkpass';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Track analytics
      await trackWalletPass('apple');

      setSuccess('Apple Wallet pass downloaded successfully!');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Error downloading Apple Wallet pass:', err);
      setError('Failed to download Apple Wallet pass. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Open Google Wallet link
   */
  const handleGoogleWalletClick = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Fetch Google Wallet JWT and URL
      const response = await fetch(
        `/api/driver-wallet-pass/google/${driverId}`
      );

      if (!response.ok) {
        throw new Error('Failed to generate Google Wallet pass');
      }

      const data = await response.json();

      if (!data.data.walletUrl) {
        throw new Error('Google Wallet integration not configured');
      }

      // Track analytics
      await trackWalletPass('google');

      // Open Google Wallet in new window
      window.open(data.data.walletUrl, '_blank', 'width=600,height=700');

      setSuccess('Opening Google Wallet...');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Error opening Google Wallet:', err);
      setError(
        err.message ||
          'Failed to open Google Wallet. Please try again or check configuration.'
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Track wallet pass addition for analytics
   */
  const trackWalletPass = async (walletType) => {
    try {
      await fetch('/api/driver-wallet-pass/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          driverId,
          walletType,
        }),
      });
    } catch (err) {
      console.error('Error tracking wallet pass:', err);
    }
  };

  if (!config) {
    return (
      <div className="wallet-pass-buttons loading">
        <p>Loading wallet options...</p>
      </div>
    );
  }

  return (
    <div className="wallet-pass-buttons-container">
      <div className="wallet-pass-header">
        <h3>📱 Add to Wallet</h3>
        <p className="subtitle">Share your driver profile QR code with customers</p>
      </div>

      <div className="wallet-pass-buttons">
        {/* Apple Wallet Button */}
        {config.appleWallet.available && (
          <button
            className="wallet-button apple-wallet-btn"
            onClick={handleAppleWalletClick}
            disabled={loading}
            title="Add your driver profile to Apple Wallet"
          >
            <svg className="wallet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
              <path d="M12 5v14M5 12h14" />
            </svg>
            <div className="button-content">
              <span className="button-title">Add to Apple Wallet</span>
              <span className="button-subtitle">{config.appleWallet.description}</span>
            </div>
            {loading && <span className="spinner" />}
          </button>
        )}

        {/* Google Wallet Button */}
        {config.googleWallet.available ? (
          <button
            className="wallet-button google-wallet-btn"
            onClick={handleGoogleWalletClick}
            disabled={loading}
            title="Add your driver profile to Google Wallet"
          >
            <svg
              className="wallet-icon"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M22 6v12" stroke="currentColor" strokeWidth="2" />
            </svg>
            <div className="button-content">
              <span className="button-title">Add to Google Wallet</span>
              <span className="button-subtitle">One-click add to Android device</span>
            </div>
            {loading && <span className="spinner" />}
          </button>
        ) : (
          <div className="wallet-button google-wallet-btn disabled">
            <svg
              className="wallet-icon"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M22 6v12" stroke="currentColor" strokeWidth="2" />
            </svg>
            <div className="button-content">
              <span className="button-title">Google Wallet</span>
              <span className="button-subtitle">Not configured yet</span>
            </div>
          </div>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <span className="alert-icon">✅</span>
          <span>{success}</span>
        </div>
      )}

      {/* Info Box */}
      <div className="wallet-pass-info">
        <div className="info-item">
          <span className="info-icon">📲</span>
          <div className="info-content">
            <h4>Easy Sharing</h4>
            <p>Customers can instantly add your driver profile to their device</p>
          </div>
        </div>
        <div className="info-item">
          <span className="info-icon">🔐</span>
          <div className="info-content">
            <h4>Always Updated</h4>
            <p>Your rating and profile automatically sync on customer devices</p>
          </div>
        </div>
        <div className="info-item">
          <span className="info-icon">⭐</span>
          <div className="info-content">
            <h4>Build Trust</h4>
            <p>Your wallet pass includes your rating and verified driver info</p>
          </div>
        </div>
      </div>
    </div>
  );
}
