import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDelivery } from '../context/deliveryContext';
import LocationPicker from '../components/LocationPicker';
import '../styles/requestDelivery.css';

export default function RequestDeliveryPage() {
  const navigate = useNavigate();
  const { createDelivery, loading, error: contextError } = useDelivery();

  const [pickupLocation, setPickupLocation] = useState(null);
  const [deliveryLocation, setDeliveryLocation] = useState(null);
  const [formData, setFormData] = useState({
    package_description: '',
    package_weight: '',
    priority: 'NORMAL',
    special_instructions: '',
  });
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // Step 1: Pickup, Step 2: Delivery, Step 3: Details

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePickupLocation = (location) => {
    setPickupLocation(location);
    setStep(2);
    setError('');
  };

  const handleDeliveryLocation = (location) => {
    setDeliveryLocation(location);
    setStep(3);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!pickupLocation || !pickupLocation.latitude || !pickupLocation.longitude) {
      setError('Please set pickup location');
      setStep(1);
      return;
    }

    if (!deliveryLocation || !deliveryLocation.latitude || !deliveryLocation.longitude) {
      setError('Please set delivery location');
      setStep(2);
      return;
    }

    if (!formData.package_description.trim()) {
      setError('Please describe the package');
      return;
    }

    try {
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
      };

      await createDelivery(deliveryData);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create delivery');
    }
  };

  return (
    <div className="request-delivery-page">
      <header className="page-header">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>
          ← Back
        </button>
        <h1>Request Delivery</h1>
      </header>

      <div className="request-container">
        <div className="progress-bar">
          <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>
            <span className="step-number">1</span>
            <span className="step-label">Pickup</span>
          </div>
          <div className={`progress-line ${step > 1 ? 'active' : ''}`}></div>
          <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">Delivery</span>
          </div>
          <div className={`progress-line ${step > 2 ? 'active' : ''}`}></div>
          <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>
            <span className="step-number">3</span>
            <span className="step-label">Details</span>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}
        {contextError && <div className="error-message">{contextError}</div>}

        <form onSubmit={handleSubmit} className="request-form">
          {/* Step 1: Pickup Location */}
          {step === 1 && (
            <div className="form-step">
              <h2>📍 Pickup Location</h2>
              <LocationPicker
                onLocationSelect={handlePickupLocation}
                label="Where are we picking up from?"
              />
            </div>
          )}

          {/* Step 2: Delivery Location */}
          {step === 2 && (
            <div className="form-step">
              <h2>🏠 Delivery Location</h2>
              <LocationPicker
                onLocationSelect={handleDeliveryLocation}
                label="Where should we deliver to?"
              />
              <button
                type="button"
                className="btn-back-step"
                onClick={() => setStep(1)}
              >
                ← Back to Pickup
              </button>
            </div>
          )}

          {/* Step 3: Delivery Details */}
          {step === 3 && (
            <div className="form-step">
              <h2>📦 Package Details</h2>

              <div className="location-summary">
                <div className="location-item">
                  <span className="label">Pickup:</span>
                  <span className="address">{pickupLocation?.address}</span>
                </div>
                <div className="arrow">↓</div>
                <div className="location-item">
                  <span className="label">Delivery:</span>
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
                  onClick={() => setStep(2)}
                  disabled={loading}
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Creating Delivery...' : '✓ Create Delivery'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
