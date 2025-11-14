import React, { useState, useRef, useEffect } from 'react';
import { qrCodeAPI } from '../services/api';
import '../styles/qrScanner.css';

export default function QRCodeScanner({ deliveryId, onSuccess, onCancel }) {
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (scanning) {
      startCamera();
    }
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, [scanning]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('Camera access denied. Use manual input instead.');
      setShowManualInput(true);
    }
  };

  const captureAndDecode = async () => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const video = videoRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    try {
      // Use jsQR or similar library for decoding
      // For now, we'll use a placeholder that expects manual input
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      // Decode logic would go here
      // For MVP, we'll rely on manual input or barcode scanner
    } catch (err) {
      console.error('Decode error:', err);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualCode.trim()) {
      setError('Please enter or scan the QR code');
      return;
    }

    setLoading(true);
    try {
      const response = await qrCodeAPI.verifyQRCodePickup(deliveryId, manualCode);

      setError('');
      setManualCode('');
      onSuccess && onSuccess(response.data.data);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'QR verification failed';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="qr-code-scanner">
      <div className="scanner-header">
        <h3>📱 Scan Pickup QR Code</h3>
        <button className="btn-close" onClick={onCancel} title="Close scanner">
          ✕
        </button>
      </div>

      {error && (
        <div className="scanner-error">
          <p>{error}</p>
          <button
            className="error-dismiss"
            onClick={() => setError('')}
          >
            Dismiss
          </button>
        </div>
      )}

      {!showManualInput && !scanning ? (
        <div className="scanner-start">
          <p className="scanner-icon">📱</p>
          <p className="scanner-text">
            Ready to scan the customer's QR code for pickup confirmation
          </p>
          <div className="scanner-buttons">
            <button
              className="btn-start-scan"
              onClick={() => setScanning(true)}
            >
              🎥 Start Camera Scan
            </button>
            <button
              className="btn-manual-input"
              onClick={() => setShowManualInput(true)}
            >
              ⌨️ Manual Input
            </button>
          </div>
        </div>
      ) : scanning ? (
        <div className="scanner-active">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="scanner-video"
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          <div className="scanner-overlay">
            <div className="scanner-frame" />
          </div>

          <p className="scanner-instruction">
            Position the QR code within the frame
          </p>

          <div className="scanner-controls">
            <button
              className="btn-stop-scan"
              onClick={() => setScanning(false)}
            >
              Stop Scanning
            </button>
            <button
              className="btn-manual-switch"
              onClick={() => {
                setScanning(false);
                setShowManualInput(true);
              }}
            >
              Switch to Manual
            </button>
          </div>
        </div>
      ) : (
        <div className="manual-input-section">
          <p className="manual-label">
            Paste or type the QR code data:
          </p>
          <textarea
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Paste QR code data here..."
            className="manual-input"
            disabled={loading}
          />

          <div className="manual-actions">
            <button
              className="btn-verify"
              onClick={handleManualSubmit}
              disabled={loading || !manualCode.trim()}
            >
              {loading ? 'Verifying...' : '✓ Verify & Confirm Pickup'}
            </button>
            <button
              className="btn-back"
              onClick={() => {
                setShowManualInput(false);
                setManualCode('');
              }}
              disabled={loading}
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
