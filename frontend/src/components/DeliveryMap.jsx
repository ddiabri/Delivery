import React, { useEffect, useRef, useState } from 'react';
import '../styles/deliveryMap.css';

/**
 * Simple map component showing delivery route
 * In production, integrate with Leaflet, Google Maps, or Mapbox
 */
export default function DeliveryMap({
  pickupLocation,
  deliveryLocation,
  driverLocation,
  status,
}) {
  const [mapType] = useState('simple'); // Can be 'leaflet', 'google', 'mapbox', etc.

  // Simple text-based map for demo
  if (mapType === 'simple') {
    return (
      <div className="delivery-map simple-map">
        <div className="map-header">📍 Delivery Route Map</div>
        <div className="route-display">
          <div className="location-point pickup">
            <span className="icon">📍</span>
            <div className="location-info">
              <strong>Pickup Location</strong>
              <small>{pickupLocation || 'Loading...'}</small>
            </div>
          </div>

          <div className="route-line">
            {status === 'IN_TRANSIT' && <div className="active-route" />}
            {status === 'DELIVERED' && <div className="completed-route" />}
            {!['IN_TRANSIT', 'DELIVERED'].includes(status) && <div className="inactive-route" />}
          </div>

          {driverLocation && status === 'IN_TRANSIT' && (
            <div className="location-point driver">
              <span className="icon">🚗</span>
              <div className="location-info">
                <strong>Driver Current Location</strong>
                <small>
                  {driverLocation.latitude?.toFixed(4)}, {driverLocation.longitude?.toFixed(4)}
                </small>
              </div>
            </div>
          )}

          <div className="location-point delivery">
            <span className="icon">📦</span>
            <div className="location-info">
              <strong>Delivery Location</strong>
              <small>{deliveryLocation || 'Loading...'}</small>
            </div>
          </div>
        </div>

        <div className="map-info">
          <p>
            <strong>Status:</strong> {status}
          </p>
          <p className="map-note">
            💡 Integrate with Leaflet, Google Maps, or Mapbox for interactive maps
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="delivery-map placeholder">
      <p>Map integration ready for Leaflet/Google Maps/Mapbox</p>
    </div>
  );
}
