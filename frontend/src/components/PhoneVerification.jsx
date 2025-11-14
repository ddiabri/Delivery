import React, { useState } from 'react';
import '../styles/phoneVerification.css';

export default function PhoneVerification({ onVerificationComplete }) {
  const [step, setStep] = useState('phone'); // 'phone' | 'verify'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [countdown, setCountdown] = useState(0);

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!phoneNumber.match(/^\+?[1-9]\d{1,14}$/)) {
      setError('Please enter a valid phone number (e.g., +1234567890)');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/notification-preferences/verify-phone/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ phone_number: phoneNumber }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send verification code');
      }

      setMessage('Verification code sent to your phone!');
      setStep('verify');
      setCountdown(600); // 10 minutes

      // Start countdown
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (verificationCode.length !== 6 || !/^\d+$/.test(verificationCode)) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/notification-preferences/verify-phone/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ token: verificationCode }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Verification failed');
      }

      setMessage('Phone verified successfully!');
      setTimeout(() => {
        onVerificationComplete(phoneNumber);
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCountdown = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="phone-verification">
      {step === 'phone' ? (
        <form onSubmit={handlePhoneSubmit} className="verification-form">
          <h3>📱 Add Phone Number</h3>
          <p className="form-description">Enter your phone number to receive SMS and WhatsApp notifications</p>

          {error && <div className="error-message">{error}</div>}
          {message && <div className="success-message">{message}</div>}

          <div className="form-group">
            <label htmlFor="phone">Phone Number</label>
            <input
              id="phone"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1234567890"
              disabled={loading}
              required
            />
            <small>Include country code (e.g., +1 for US, +44 for UK)</small>
          </div>

          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send Verification Code'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifySubmit} className="verification-form">
          <h3>✓ Verify Code</h3>
          <p className="form-description">
            Enter the 6-digit code we sent to {phoneNumber}
          </p>

          {error && <div className="error-message">{error}</div>}
          {message && <div className="success-message">{message}</div>}

          <div className="form-group">
            <label htmlFor="code">Verification Code</label>
            <input
              id="code"
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength="6"
              disabled={loading}
              required
              className="code-input"
            />
          </div>

          <div className="countdown">
            {countdown > 0 ? (
              <p>Code expires in {formatCountdown(countdown)}</p>
            ) : (
              <button
                type="button"
                className="btn-resend"
                onClick={() => {
                  setStep('phone');
                  setVerificationCode('');
                }}
              >
                Request new code
              </button>
            )}
          </div>

          <button type="submit" className="btn-submit" disabled={loading || verificationCode.length !== 6}>
            {loading ? 'Verifying...' : 'Verify Phone'}
          </button>

          <button
            type="button"
            className="btn-back"
            onClick={() => {
              setStep('phone');
              setVerificationCode('');
              setError(null);
            }}
            disabled={loading}
          >
            Change phone number
          </button>
        </form>
      )}
    </div>
  );
}
