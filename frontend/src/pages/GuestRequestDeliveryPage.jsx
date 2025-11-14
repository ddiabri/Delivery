import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { guestDeliveryAPI } from '../services/api';
import LocationPicker from '../components/LocationPicker';
import '../styles/guestRequest.css';

export default function GuestRequestDeliveryPage() {
  const navigate = useNavigate();
  const [pickupLocation, setPickupLocation] = useState(null);
  const [deliveryLocation, setDeliveryLocation] = useState(null);
  const [formData, setFormData] = useState({
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    package_description: '',
    package_weight: '',
    priority: 'NORMAL',
    special_instructions: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // Step 1: Contact, Step 2: Pickup, Step 3: Delivery, Step 4: Details
  const [submittedDelivery, setSubmittedDelivery] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePickupLocation = (location) => {
    setPickupLocation(location);
    setStep(3);
    setError('');
  };

  const handleDeliveryLocation = (location) => {
    setDeliveryLocation(location);
    setStep(4);
    setError('');
  };

  const validateStep1 = () => {
    const errors = [];
    if (!formData.guest_name.trim()) {
      errors.push('Name is required');
    }
    if (!formData.guest_phone.trim()) {
      errors.push('Phone number is required');
    }
    if (formData.guest_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.guest_email)) {
      errors.push('Invalid email format');
    }

    if (errors.length > 0) {
      setError(errors.join(', '));
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!pickupLocation || !pickupLocation.latitude || !pickupLocation.longitude) {
      setError('Please set pickup location');
      setStep(2);
      return;
    }

    if (!deliveryLocation || !deliveryLocation.latitude || !deliveryLocation.longitude) {
      setError('Please set delivery location');
      setStep(3);
      return;
    }

    if (!formData.package_description.trim()) {
      setError('Please describe the package');
      return;
    }

    try {
      setLoading(true);
      const deliveryData = {
        pickup_address: pickupLocation.address,
        pickup_latitude: pickupLocation.latitude,
        pickup_longitude: pickupLocation.longitude,
        delivery_address: deliveryLocation.address,
        delivery_latitude: deliveryLocation.latitude,
        delivery_longitude: deliveryLocation.longitude,
        package_description: formData.package_description,
        package_weight: formData.package_weight ? parseFloat(formData.package_weight) : null,
        priority: formData.priority,
        special_instructions: formData.special_instructions,
        guest_name: formData.guest_name,
        guest_email: formData.guest_email || null,
        guest_phone: formData.guest_phone,
      };

      const response = await guestDeliveryAPI.createGuestDelivery(deliveryData);
      setSubmittedDelivery(response.data.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create delivery');
      console.error('Error creating guest delivery:', err);
    } finally {
      setLoading(false);
    }
  };

  // Success Screen
  if (submittedDelivery) {
    return (
      <div className="guest-request-page">
        <header className="page-header">
          <h1>Delivery Request Submitted</h1>
        </header>

        <div className="request-container">
          <div className="success-screen">
            <div className="success-icon">✓</div>
            <h2>Request Submitted Successfully!</h2>

            <div className="delivery-summary">
              <h3>Delivery Details</h3>
              <div className="summary-item">
                <span className="label">Delivery ID:</span>
                <span className="value">{submittedDelivery.deliveryId}</span>
              </div>
              <div className="summary-item">
                <span className="label">Guest Name:</span>
                <span className="value">{submittedDelivery.guestName}</span>
              </div>
              <div className="summary-item">
                <span className="label">Guest Phone:</span>
                <span className="value">{submittedDelivery.guestPhone}</span>
              </div>
              <div className="summary-item">
                <span className="label">Status:</span>
                <span className="value status-badge pending">{submittedDelivery.status}</span>
              </div>
            </div>

            <div className="tracking-info">
              <h3>Track Your Delivery</h3>
              <p>Use this link to track your delivery:</p>
              <input
                type="text"
                className="tracking-link"
                value={submittedDelivery.trackingLink}
                readOnly
              />
              <button
                className="btn-copy-link"
                onClick={() => {
                  navigator.clipboard.writeText(submittedDelivery.trackingLink);
                  alert('Tracking link copied to clipboard!');
                }}
              >
                📋 Copy Link
              </button>

              <div className="tracking-tips">
                <h4>💡 Tips:</h4>
                <ul>
                  <li>Save this link to track your delivery status</li>
                  <li>You can share this link with others</li>
                  {submittedDelivery.trackingLink && (
                    <li>Open this link on any device to check your delivery</li>
                  )}
                </ul>
              </div>
            </div>

            <div className="action-buttons">
              <button
                className="btn-back-home"
                onClick={() => navigate('/')}
              >
                ← Back to Home
              </button>
              <button
                className="btn-new-request"
                onClick={() => {
                  setSubmittedDelivery(null);
                  setStep(1);
                  setFormData({
                    guest_name: '',
                    guest_email: '',
                    guest_phone: '',
                    package_description: '',
                    package_weight: '',
                    priority: 'NORMAL',
                    special_instructions: '',
                  });
                  setPickupLocation(null);
                  setDeliveryLocation(null);
                }}
              >
                + New Request
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="guest-request-page">
      <header className="page-header">
        <button className="btn-back" onClick={() => navigate('/')}>
          ← Back
        </button>
        <h1>Request Delivery (Guest)</h1>
        <p className="subtitle">No account needed - Just provide your details</p>
      </header>

      <div className="request-container">
        <div className="progress-bar">
          <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>
            <span className="step-number">1</span>
            <span className="step-label">Contact</span>
          </div>
          <div className={`progress-line ${step > 1 ? 'active' : ''}`}></div>
          <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">Pickup</span>
          </div>
          <div className={`progress-line ${step > 2 ? 'active' : ''}`}></div>
          <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>
            <span className="step-number">3</span>
            <span className="step-label">Delivery</span>
          </div>
          <div className={`progress-line ${step > 3 ? 'active' : ''}`}></div>
          <div className={`progress-step ${step >= 4 ? 'active' : ''}`}>
            <span className="step-number">4</span>
            <span className="step-label">Details</span>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="request-form">
          {/* Step 1: Contact Information */}
          {step === 1 && (
            <div className="form-step">
              <h2>👤 Your Contact Information</h2>

              <div className="form-group">
                <label htmlFor="guest_name">Full Name *</label>
                <input
                  type="text"
                  id="guest_name"
                  name="guest_name"
                  value={formData.guest_name}
                  onChange={handleInputChange}
                  placeholder="e.g., John Doe"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="guest_phone">Phone Number *</label>
                <input
                  type="tel"
                  id="guest_phone"
                  name="guest_phone"
                  value={formData.guest_phone}
                  onChange={handleInputChange}
                  placeholder="e.g., +1 (555) 123-4567"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="guest_email">Email (Optional)</label>
                <input
                  type="email"
                  id="guest_email"
                  name="guest_email"
                  value={formData.guest_email}
                  onChange={handleInputChange}
                  placeholder="e.g., john@example.com"
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    if (validateStep1()) {
                      setStep(2);
                      setError('');
                    }
                  }}
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Pickup Location */}
          {step === 2 && (
            <div className="form-step">
              <h2>📍 Pickup Location</h2>
              <LocationPicker
                onLocationSelect={handlePickupLocation}
                label="Where are we picking up from?"
              />
              <button
                type="button"
                className="btn-back-step"
                onClick={() => setStep(1)}
              >
                ← Back
              </button>
            </div>
          )}

          {/* Step 3: Delivery Location */}
          {step === 3 && (
            <div className="form-step">
              <h2>🏠 Delivery Location</h2>
              <LocationPicker
                onLocationSelect={handleDeliveryLocation}
                label="Where should we deliver to?"
              />
              <button
                type="button"
                className="btn-back-step"
                onClick={() => setStep(2)}
              >
                ← Back to Pickup
              </button>
            </div>
          )}

          {/* Step 4: Package Details */}
          {step === 4 && (
            <div className="form-step">
              <h2>📦 Package Details</h2>

              <div className="location-summary">
                <div className="location-item">
                  <span className="label">From:</span>
                  <span className="address">{pickupLocation?.address}</span>
                </div>
                <div className="arrow">↓</div>
                <div className="location-item">
                  <span className="label">To:</span>
                  <span className="address">{deliveryLocation?.address}</span>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="package_description">Package Description *</label>
                <textarea
                  id="package_description"
                  name="package_description"
                  value={formData.package_description}
                  onChange={handleInputChange}
                  placeholder="e.g., Important documents, fragile items, etc."
                  rows="4"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="package_weight">Weight (kg)</label>
                  <input
                    type="number"
                    id="package_weight"
                    name="package_weight"
                    value={formData.package_weight}
                    onChange={handleInputChange}
                    placeholder="e.g., 2.5"
                    step="0.1"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="priority">Priority Level *</label>
                  <select
                    id="priority"
                    name="priority"
                    value={formData.priority}
                    onChange={handleInputChange}
                  >
                    <option value="LOW">🟢 Low (Standard)</option>
                    <option value="NORMAL">🟡 Normal (Regular)</option>
                    <option value="HIGH">🟠 High (Faster)</option>
                    <option value="URGENT">🔴 Urgent (Fastest)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="special_instructions">Special Instructions</label>
                <textarea
                  id="special_instructions"
                  name="special_instructions"
                  value={formData.special_instructions}
                  onChange={handleInputChange}
                  placeholder="e.g., Handle with care, call before delivery, etc."
                  rows="3"
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setStep(3)}
                  disabled={loading}
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Submitting...' : '✓ Submit Request'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
