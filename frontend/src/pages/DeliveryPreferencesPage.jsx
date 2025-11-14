import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/authContext';
import '../styles/deliveryPreferences.css';

export default function DeliveryPreferencesPage() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showLocationForm, setShowLocationForm] = useState(null); // 'preferred' or 'excluded'
  const [newLocation, setNewLocation] = useState({ name: '', address: '', latitude: '', longitude: '' });

  const daysOfWeek = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/delivery-preferences', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch preferences');

      const data = await response.json();
      setPreferences(data.preferences);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenceChange = async (key, value) => {
    const updatedPreferences = { ...preferences, [key]: value };
    setPreferences(updatedPreferences);

    try {
      setSaving(true);
      const response = await fetch('/api/delivery-preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ [key]: value }),
      });

      if (!response.ok) throw new Error('Failed to update preferences');

      setSuccessMessage('Preferences updated successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      setError(null);
    } catch (err) {
      setError(err.message);
      setPreferences(preferences); // Revert
    } finally {
      setSaving(false);
    }
  };

  const handleAddLocation = async (type) => {
    if (!newLocation.address) {
      setError('Please enter a location address');
      return;
    }

    try {
      setSaving(true);
      const endpoint = type === 'preferred' ? '/api/delivery-preferences/preferred-locations' : '/api/delivery-preferences/excluded-locations';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          location: newLocation.address,
          name: newLocation.name,
          latitude: parseFloat(newLocation.latitude) || 0,
          longitude: parseFloat(newLocation.longitude) || 0,
          radius: 5,
        }),
      });

      if (!response.ok) throw new Error('Failed to add location');

      const data = await response.json();
      setPreferences(data.preferences);
      setNewLocation({ name: '', address: '', latitude: '', longitude: '' });
      setShowLocationForm(null);
      setSuccessMessage('Location added successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLocation = async (locationId, type) => {
    try {
      setSaving(true);
      const endpoint = type === 'preferred' ? `/api/delivery-preferences/preferred-locations/${locationId}` : `/api/delivery-preferences/excluded-locations/${locationId}`;

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to remove location');

      const data = await response.json();
      setPreferences(data.preferences);
      setSuccessMessage('Location removed successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day) => {
    const currentDays = preferences.preferred_days_of_week || [];
    const updatedDays = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day];
    handlePreferenceChange('preferred_days_of_week', updatedDays);
  };

  if (loading) {
    return <div className="loading">Loading delivery preferences...</div>;
  }

  if (!preferences) {
    return (
      <div className="error-container">
        <p>{error || 'Failed to load preferences'}</p>
        <button onClick={fetchPreferences}>Try Again</button>
      </div>
    );
  }

  return (
    <div className="delivery-preferences-page">
      <header className="page-header">
        <h1>🎯 Delivery Preferences</h1>
        <p>Customize how you receive deliveries</p>
      </header>

      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      <div className="preferences-container">
        {/* Days of Week */}
        <section className="preference-section">
          <h2>📅 Preferred Days</h2>
          <p className="section-description">Select days when you're available for delivery</p>
          <div className="days-grid">
            {daysOfWeek.map((day) => (
              <button
                key={day}
                className={`day-btn ${preferences.preferred_days_of_week?.includes(day) ? 'active' : ''}`}
                onClick={() => toggleDay(day)}
              >
                {day.substring(0, 3)}
              </button>
            ))}
          </div>
        </section>

        {/* Time Windows */}
        <section className="preference-section">
          <h2>⏰ Preferred Time Windows</h2>
          <p className="section-description">Specify hours when you're available</p>
          <div className="time-windows">
            {preferences.preferred_time_windows?.map((window, index) => (
              <div key={index} className="time-window">
                <span>{window.start} - {window.end}</span>
              </div>
            ))}
          </div>
          <p className="note">Time windows can be customized by contacting support</p>
        </section>

        {/* Weight Preference */}
        <section className="preference-section">
          <h2>⚖️ Maximum Package Weight</h2>
          <p className="section-description">Maximum weight you can receive</p>
          <div className="input-group">
            <input
              type="number"
              step="0.1"
              value={preferences.max_weight_preference || ''}
              onChange={(e) => handlePreferenceChange('max_weight_preference', e.target.value ? parseFloat(e.target.value) : null)}
              placeholder="e.g., 50"
              disabled={saving}
            />
            <span className="unit">kg</span>
          </div>
        </section>

        {/* Delivery Radius */}
        <section className="preference-section">
          <h2>📍 Delivery Radius</h2>
          <p className="section-description">Maximum distance for deliveries</p>
          <div className="input-group">
            <input
              type="number"
              step="0.1"
              value={preferences.delivery_radius_km || ''}
              onChange={(e) => handlePreferenceChange('delivery_radius_km', e.target.value ? parseFloat(e.target.value) : null)}
              placeholder="e.g., 10"
              disabled={saving}
            />
            <span className="unit">km</span>
          </div>
        </section>

        {/* Preferred Locations */}
        <section className="preference-section">
          <div className="section-header">
            <h2>⭐ Preferred Delivery Locations</h2>
            <button className="btn-add" onClick={() => setShowLocationForm('preferred')} disabled={saving}>
              + Add Location
            </button>
          </div>
          <p className="section-description">Locations where you prefer to receive deliveries</p>

          {showLocationForm === 'preferred' && (
            <div className="location-form">
              <input
                type="text"
                value={newLocation.name}
                onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                placeholder="Location name (e.g., Home, Office)"
              />
              <input
                type="text"
                value={newLocation.address}
                onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })}
                placeholder="Address"
              />
              <div className="form-row">
                <input
                  type="number"
                  step="0.00001"
                  value={newLocation.latitude}
                  onChange={(e) => setNewLocation({ ...newLocation, latitude: e.target.value })}
                  placeholder="Latitude"
                />
                <input
                  type="number"
                  step="0.00001"
                  value={newLocation.longitude}
                  onChange={(e) => setNewLocation({ ...newLocation, longitude: e.target.value })}
                  placeholder="Longitude"
                />
              </div>
              <div className="form-actions">
                <button className="btn-submit" onClick={() => handleAddLocation('preferred')} disabled={saving}>
                  Add
                </button>
                <button className="btn-cancel" onClick={() => setShowLocationForm(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="locations-list">
            {preferences.preferred_locations?.length > 0 ? (
              preferences.preferred_locations.map((loc) => (
                <div key={loc.id} className="location-item">
                  <div className="location-info">
                    <strong>{loc.name}</strong>
                    <p>{loc.address}</p>
                  </div>
                  <button
                    className="btn-remove"
                    onClick={() => handleRemoveLocation(loc.id, 'preferred')}
                    disabled={saving}
                  >
                    ✕
                  </button>
                </div>
              ))
            ) : (
              <p className="empty-text">No preferred locations set</p>
            )}
          </div>
        </section>

        {/* Excluded Locations */}
        <section className="preference-section">
          <div className="section-header">
            <h2>🚫 Excluded Delivery Locations</h2>
            <button className="btn-add" onClick={() => setShowLocationForm('excluded')} disabled={saving}>
              + Add Location
            </button>
          </div>
          <p className="section-description">Locations where you don't want deliveries</p>

          {showLocationForm === 'excluded' && (
            <div className="location-form">
              <input
                type="text"
                value={newLocation.address}
                onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })}
                placeholder="Address to exclude"
              />
              <input
                type="number"
                step="0.1"
                value={newLocation.name}
                onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                placeholder="Exclusion radius (km)"
              />
              <div className="form-actions">
                <button className="btn-submit" onClick={() => handleAddLocation('excluded')} disabled={saving}>
                  Add
                </button>
                <button className="btn-cancel" onClick={() => setShowLocationForm(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="locations-list">
            {preferences.excluded_locations?.length > 0 ? (
              preferences.excluded_locations.map((loc) => (
                <div key={loc.id} className="location-item">
                  <div className="location-info">
                    <strong>{loc.address}</strong>
                    <p>Radius: {loc.radius} km</p>
                  </div>
                  <button
                    className="btn-remove"
                    onClick={() => handleRemoveLocation(loc.id, 'excluded')}
                    disabled={saving}
                  >
                    ✕
                  </button>
                </div>
              ))
            ) : (
              <p className="empty-text">No excluded locations set</p>
            )}
          </div>
        </section>

        {/* Special Preferences */}
        <section className="preference-section">
          <h2>🎯 Special Instructions</h2>
          <p className="section-description">Any special instructions for drivers</p>
          <textarea
            value={preferences.special_instructions || ''}
            onChange={(e) => handlePreferenceChange('special_instructions', e.target.value)}
            placeholder="e.g., Ring doorbell twice, leave at back door..."
            rows="4"
            disabled={saving}
          />
        </section>

        {/* Delivery Options */}
        <section className="preference-section">
          <h2>✅ Delivery Options</h2>
          <p className="section-description">Set requirements for deliveries</p>

          <div className="option-card">
            <div className="option-info">
              <h3>Require Signature</h3>
              <p>Delivery must be signed for</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={preferences.require_signature}
                onChange={(e) => handlePreferenceChange('require_signature', e.target.checked)}
                disabled={saving}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="option-card">
            <div className="option-info">
              <h3>Accept Cash Payment</h3>
              <p>Allow drivers to accept cash on delivery</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={preferences.allow_cash_payment}
                onChange={(e) => handlePreferenceChange('allow_cash_payment', e.target.checked)}
                disabled={saving}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
