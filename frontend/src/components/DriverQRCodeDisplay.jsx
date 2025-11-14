import React, { useState, useEffect } from 'react';
import { driverQRCodeAPI } from '../services/api';
import '../styles/driverQRCode.css';

export default function DriverQRCodeDisplay({ driverId, driverName }) {
  const [qrCode, setQrCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchDriverQRCode();
  }, [driverId]);

  const fetchDriverQRCode = async () => {
    try {
      setLoading(true);
      const response = await driverQRCodeAPI.getDriverQRCode(driverId);
      setQrCode(response.data.data.qrCode);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate QR code');
      console.error('Error fetching driver QR code:', err);
    } finally {
      setLoading(false);
    }
  };

  const downloadQRCode = () => {
    const link = document.createElement('a');
    link.href = qrCode;
    link.download = `${driverName}-qr-code.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyQRCode = async () => {
    try {
      const canvas = document.createElement('canvas');
      const img = new Image();

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);

        canvas.toBlob((blob) => {
          navigator.clipboard.write([
            new ClipboardItem({
              'image/png': blob,
            }),
          ]);

          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      };

      img.src = qrCode;
    } catch (err) {
      console.error('Error copying QR code:', err);
    }
  };

  if (loading) {
    return (
      <div className="driver-qr-code-display">
        <div className="loading">Generating QR code...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="driver-qr-code-display">
        <div className="error">{error}</div>
        <button className="btn-retry" onClick={fetchDriverQRCode}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="driver-qr-code-display">
      <div className="qr-content">
        <h3>📱 Share Your Profile</h3>
        <p className="subtitle">Share this QR code with customers to get referrals</p>

        <div className="qr-container">
          {qrCode && <img src={qrCode} alt="Driver QR Code" className="qr-image" />}
        </div>

        <div className="qr-info">
          <p className="info-text">Customers can scan this QR code to request delivery from you</p>
        </div>

        <div className="qr-actions">
          <button className="btn-download" onClick={downloadQRCode} title="Download QR code">
            ⬇️ Download
          </button>
          <button className="btn-copy" onClick={copyQRCode} title="Copy QR code">
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
          <button className="btn-refresh" onClick={fetchDriverQRCode} title="Refresh QR code">
            🔄 Refresh
          </button>
        </div>

        <div className="qr-tips">
          <h4>💡 Tips for Getting More Deliveries:</h4>
          <ul>
            <li>Share your QR code on social media</li>
            <li>Print it and display it at your location</li>
            <li>Send it to customers via email or messaging</li>
            <li>Keep your profile updated with good ratings</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
