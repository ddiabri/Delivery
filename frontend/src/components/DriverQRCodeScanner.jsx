import React, { useState, useRef, useEffect } from 'react';
import jsQR from 'jsqr';
import { driverQRCodeAPI } from '../services/api';
import DriverProfileModal from './DriverProfileModal';
import '../styles/driverQRScanner.css';

export default function DriverQRCodeScanner({ onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState('');
  const [manualInputMode, setManualInputMode] = useState(false);
  const [manualQRInput, setManualQRInput] = useState('');
  const [scanning, setScanning] = useState(true);
  const [driverInfo, setDriverInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!cameraActive) {
      startCamera();
    }

    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
        setError('');
        captureAndDecode();
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Camera access denied. Please use manual input instead.');
      setManualInputMode(true);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      setCameraActive(false);
    }
  };

  const captureAndDecode = () => {
    if (!scanning) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (canvas && video && video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qrCode = jsQR(imageData.data, canvas.width, canvas.height);

        if (qrCode) {
          const qrData = qrCode.data;
          console.log('QR Code detected:', qrData);
          handleQRCodeScanned(qrData);
          return;
        }
      } catch (err) {
        console.error('Error decoding QR code:', err);
      }
    }

    if (scanning) {
      requestAnimationFrame(captureAndDecode);
    }
  };

  const handleQRCodeScanned = async (qrData) => {
    setScanning(false);
    setLoading(true);

    try {
      const response = await driverQRCodeAPI.verifyDriverQRCode(qrData);
      setDriverInfo(response.data.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to verify driver QR code');
      console.error('Error verifying driver QR code:', err);
      setScanning(true);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = () => {
    if (!manualQRInput.trim()) {
      setError('Please enter QR code data');
      return;
    }

    handleQRCodeScanned(manualQRInput);
  };

  if (driverInfo) {
    return (
      <DriverProfileModal
        driverInfo={driverInfo}
        onClose={onClose}
        onProceed={() => {
          onClose(driverInfo);
        }}
      />
    );
  }

  return (
    <div className="driver-qr-scanner-modal">
      <div className="scanner-header">
        <h2>📱 Scan Driver QR Code</h2>
        <button className="btn-close" onClick={onClose}>
          ✕
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {!manualInputMode && cameraActive ? (
        <div className="scanner-container">
          <video
            ref={videoRef}
            className="scanner-video"
            autoPlay
            playsInline
            onLoadedMetadata={() => {
              if (!scanning) setScanning(true);
            }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          <div className="scanner-frame">
            <div className="corner corner-tl"></div>
            <div className="corner corner-tr"></div>
            <div className="corner corner-bl"></div>
            <div className="corner corner-br"></div>
          </div>

          <div className="scanner-instructions">
            {loading ? <p>Verifying QR code...</p> : <p>Point camera at driver QR code</p>}
          </div>

          <button
            className="btn-manual-input"
            onClick={() => {
              setManualInputMode(true);
              setScanning(false);
            }}
          >
            📝 Manual Input
          </button>
        </div>
      ) : null}

      {manualInputMode && (
        <div className="manual-input-container">
          <h3>Enter QR Code Data</h3>
          <p>If you can't scan the QR code, paste the data here:</p>

          <textarea
            className="manual-input-area"
            placeholder="Paste QR code data here..."
            value={manualQRInput}
            onChange={(e) => setManualQRInput(e.target.value)}
            disabled={loading}
          />

          <div className="manual-actions">
            <button
              className="btn-submit"
              onClick={handleManualSubmit}
              disabled={loading || !manualQRInput.trim()}
            >
              {loading ? 'Verifying...' : 'Verify Driver'}
            </button>
            <button
              className="btn-back-to-camera"
              onClick={() => {
                setManualInputMode(false);
                setManualQRInput('');
                setScanning(true);
              }}
              disabled={loading}
            >
              Back to Camera
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
