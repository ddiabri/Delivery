import React, { useState, useEffect } from 'react';
import '../styles/locationPicker.css';

export default function LocationPicker({ onLocationSelect, label = 'Select Location' }) {
  const [location, setLocation] = useState({
    address: '',
    latitude: 0,
    longitude: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);

  const handleGetCurrentLocation = () => {
    setLoading(true);
    setError('');

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLocation((prev) => ({
            ...prev,
            latitude,
            longitude,
          }));
          onLocationSelect({
            ...location,
            latitude,
            longitude,
          });
          setLoading(false);
          setUseCurrentLocation(true);
        },
        (error) => {
          setError('Unable to get your location. Please enable location services.');
          setLoading(false);
          console.error('Geolocation error:', error);
        }
      );
    } else {
      setError('Geolocation is not supported by your browser.');
      setLoading(false);
    }
  };

  const handleAddressChange = (e) => {
    const address = e.target.value;
    setLocation((prev) => ({
      ...prev,
      address,
    }));
  };

  const handleCoordinateChange = (e) => {
    const { name, value } = e.target;
    setLocation((prev) => ({
      ...prev,
      [name]: parseFloat(value) || 0,
    }));
  };

  const handleConfirm = () => {
    if (!location.address) {
      setError('Please enter an address');
      return;
    }

    if (!location.latitude || !location.longitude) {
      setError('Please set coordinates or use current location');
      return;
    }

    onLocationSelect(location);
  };

  return (
    <div className="location-picker">
      <label className="location-label">{label}</label>

      {error && <div className="error-message">{error}</div>}

      <div className="location-form">
        <div className="form-group">
          <label htmlFor="address">Address</label>
          <input
            type="text"
            id="address"
            value={location.address}
            onChange={handleAddressChange}
            placeholder="Enter delivery address"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="latitude">Latitude</label>
            <input
              type="number"
              id="latitude"
              name="latitude"
              value={location.latitude}
              onChange={handleCoordinateChange}
              placeholder="0.0000"
              step="0.0001"
            />
          </div>

          <div className="form-group">
            <label htmlFor="longitude">Longitude</label>
            <input
              type="number"
              id="longitude"
              name="longitude"
              value={location.longitude}
              onChange={handleCoordinateChange}
              placeholder="0.0000"
              step="0.0001"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleGetCurrentLocation}
          className="btn-location"
          disabled={loading}
        >
          {loading ? '📍 Getting location...' : '📍 Use Current Location'}
        </button>

        {useCurrentLocation && (
          <div className="location-info">
            ✓ Location set from GPS
            <br />
            Lat: {location.latitude.toFixed(4)}, Lon: {location.longitude.toFixed(4)}
          </div>
        )}

        <button
          type="button"
          onClick={handleConfirm}
          className="btn-confirm"
        >
          ✓ Confirm Location
        </button>
      </div>
    </div>
  );
}
