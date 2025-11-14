import React, { useState, useEffect } from 'react';
import { qrCodeAPI } from '../services/api';
import '../styles/qrCode.css';

export default function QRCodeDisplay({ deliveryId, status, onScanned }) {
  const [qrCode, setQRCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [scanInfo, setScanInfo] = useState(null);

  useEffect(() => {
    if (status === 'ACCEPTED' || status === 'PENDING') {
      generateQRCode();
      checkScanStatus();
    }
  }, [deliveryId, status]);

  const generateQRCode = async () => {
    setLoading(true);
    try {
      const response = await qrCodeAPI.generateQRCode(deliveryId);
      setQRCode(response.data.data.qrCode);
      setError('');
    } catch (err) {
      console.error('QR code generation error:', err);
      setError('Failed to generate QR code');
    } finally {
      setLoading(false);
    }
  };

  const checkScanStatus = async () => {
    try {
      const response = await qrCodeAPI.getQRCodeInfo(deliveryId);
      setScanInfo(response.data.data);

      // If already scanned, notify parent component
      if (response.data.data.qrCodeScanned && onScanned) {
        onScanned(response.data.data.scanDetails);
      }
    } catch (err) {
      console.error('Check scan status error:', err);
    }
  };

  const downloadQRCode = () => {
    if (!qrCode) return;

    const link = document.createElement('a');
    link.href = qrCode;
    link.download = `delivery-qr-${deliveryId.substring(0, 8)}.png`;
    link.click();
  };

  const copyQRLink = () => {
    if (qrCode) {
      navigator.clipboard.writeText(qrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="qr-code-display">
      <div className="qr-header">
        <h3>📱 Pickup Verification QR Code</h3>
        <p className="qr-description">
          Share this QR code with your driver for pickup confirmation
        </p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="qr-loading">
          <p>Generating QR code...</p>
        </div>
      ) : qrCode ? (
        <>
          <div className="qr-code-container">
            <img
              src={qrCode}
              alt="Delivery QR Code"
              className="qr-code-image"
              title="Scan this QR code during pickup"
            />
          </div>

          <div className="qr-actions">
            <button className="qr-btn" onClick={downloadQRCode} title="Download QR code">
              ⬇️ Download
            </button>
            <button
              className="qr-btn"
              onClick={copyQRLink}
              title={copied ? 'Copied!' : 'Copy QR code'}
            >
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>
            <button
              className="qr-btn"
              onClick={generateQRCode}
              title="Regenerate QR code"
            >
              🔄 Refresh
            </button>
          </div>

          {scanInfo && (
            <div className="scan-status">
              {scanInfo.qrCodeScanned ? (
                <div className="scan-confirmed">
                  <p className="status-icon">✓</p>
                  <p className="status-text">
                    <strong>Pickup Confirmed!</strong>
                  </p>
                  <p className="scan-details">
                    Scanned at:{' '}
                    {new Date(scanInfo.scanDetails.scannedAt).toLocaleString()}
                  </p>
                </div>
              ) : (
                <div className="scan-pending">
                  <p className="status-icon">⏳</p>
                  <p className="status-text">
                    <strong>Waiting for driver to scan...</strong>
                  </p>
                  <p className="scan-details">
                    Status: {scanInfo.status}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="qr-tips">
            <h4>💡 Tips for successful scanning:</h4>
            <ul>
              <li>Ensure good lighting during scan</li>
              <li>Keep the QR code in frame</li>
              <li>Avoid glare and shadows</li>
              <li>Show the code clearly to driver</li>
            </ul>
          </div>
        </>
      ) : (
        <div className="qr-empty">
          <button className="generate-btn" onClick={generateQRCode}>
            Generate QR Code
          </button>
        </div>
      )}
    </div>
  );
}
