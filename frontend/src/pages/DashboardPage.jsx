import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { useDelivery } from '../context/deliveryContext';
import DriverQRCodeScanner from '../components/DriverQRCodeScanner';
import DriverQRCodeDisplay from '../components/DriverQRCodeDisplay';
import PointsDashboard from '../components/PointsDashboard';
import NotificationCenter from '../components/NotificationCenter';
import '../styles/dashboard.css';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { deliveries, fetchDeliveries, loading } = useDelivery();
  const [showQRScanner, setShowQRScanner] = useState(false);

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNewDelivery = () => {
    if (user?.role === 'customer') {
      navigate('/request-delivery');
    } else if (user?.role === 'driver') {
      navigate('/available-deliveries');
    }
  };

  const handleQRCodeScanned = (driverInfo) => {
    setShowQRScanner(false);
    // Navigate to request delivery page with driver pre-selected
    navigate('/request-delivery', {
      state: { driverInfo }
    });
  };

  const handleViewDelivery = (deliveryId) => {
    navigate(`/delivery/${deliveryId}`);
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>📦 Delivery App</h1>
          <div className="header-actions">
            <NotificationCenter />
            <span className="user-info">
              {user?.full_name} ({user?.role})
            </span>
            <button onClick={handleLogout} className="btn-logout">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-container">
          <section className="stats-section">
            <div className="stat-card">
              <h3>Total Deliveries</h3>
              <p className="stat-value">{deliveries.length}</p>
            </div>

            {user?.role === 'customer' && (
              <>
                <div className="stat-card">
                  <h3>Pending</h3>
                  <p className="stat-value">
                    {deliveries.filter((d) => d.status === 'PENDING').length}
                  </p>
                </div>
                <div className="stat-card">
                  <h3>Completed</h3>
                  <p className="stat-value">
                    {deliveries.filter((d) => d.status === 'DELIVERED').length}
                  </p>
                </div>
              </>
            )}

            {user?.role === 'driver' && (
              <>
                <div className="stat-card">
                  <h3>Active</h3>
                  <p className="stat-value">
                    {deliveries.filter(
                      (d) =>
                        d.status === 'ACCEPTED' ||
                        d.status === 'PICKED_UP' ||
                        d.status === 'IN_TRANSIT'
                    ).length}
                  </p>
                </div>
                <div className="stat-card">
                  <h3>Completed</h3>
                  <p className="stat-value">
                    {deliveries.filter((d) => d.status === 'DELIVERED').length}
                  </p>
                </div>
              </>
            )}
          </section>

          {/* Driver QR Code Section */}
          {user?.role === 'driver' && user?.id && (
            <DriverQRCodeDisplay
              driverId={user.id}
              driverName={user.full_name}
            />
          )}

          {/* Points Dashboard Section */}
          <section className="section-header">
            <h2>💰 Points & Rewards</h2>
          </section>
          <PointsDashboard />

          <section className="deliveries-section">
            <div className="section-header">
              <h2>
                {user?.role === 'customer'
                  ? 'My Deliveries'
                  : 'Available Deliveries'}
              </h2>
              <div className="header-buttons">
                {user?.role === 'customer' && (
                  <button
                    onClick={() => setShowQRScanner(true)}
                    className="btn-secondary"
                    disabled={loading}
                    title="Scan driver QR code to request delivery"
                  >
                    📱 Scan Driver
                  </button>
                )}
                <button
                  onClick={handleNewDelivery}
                  className="btn-primary"
                  disabled={loading}
                >
                  {user?.role === 'customer'
                    ? '+ New Request'
                    : '+ Find Deliveries'}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="loading">Loading deliveries...</div>
            ) : deliveries.length === 0 ? (
              <div className="empty-state">
                <p>
                  {user?.role === 'customer'
                    ? 'No deliveries yet. Create one to get started!'
                    : 'No available deliveries nearby.'}
                </p>
              </div>
            ) : (
              <div className="deliveries-list">
                {deliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className="delivery-card"
                    onClick={() => handleViewDelivery(delivery.id)}
                  >
                    <div className="delivery-header">
                      <h3>{delivery.pickup_address}</h3>
                      <span className={`status-badge ${delivery.status.toLowerCase()}`}>
                        {delivery.status}
                      </span>
                    </div>

                    <div className="delivery-details">
                      <p>
                        <strong>To:</strong> {delivery.delivery_address}
                      </p>
                      {delivery.priority && (
                        <p>
                          <strong>Priority:</strong>{' '}
                          <span className={`priority ${delivery.priority.toLowerCase()}`}>
                            {delivery.priority}
                          </span>
                        </p>
                      )}
                      {delivery.estimated_delivery_time && (
                        <p>
                          <strong>Est. Delivery:</strong>{' '}
                          {new Date(
                            delivery.estimated_delivery_time
                          ).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Driver QR Code Scanner Modal */}
      {showQRScanner && user?.role === 'customer' && (
        <DriverQRCodeScanner
          onClose={() => setShowQRScanner(false)}
          onSuccess={handleQRCodeScanned}
        />
      )}
    </div>
  );
}
