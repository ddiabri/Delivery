import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/authContext';
import { DeliveryProvider } from './context/deliveryContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import RequestDeliveryPage from './pages/RequestDeliveryPage';
import AvailableDeliveriesPage from './pages/AvailableDeliveriesPage';
import DeliveryDetailPage from './pages/DeliveryDetailPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminDeliveriesPage from './pages/AdminDeliveriesPage';
import AdminReviewsPage from './pages/AdminReviewsPage';
import DriverDashboardPage from './pages/DriverDashboardPage';
import GuestRequestDeliveryPage from './pages/GuestRequestDeliveryPage';
import GuestDeliveryTrackingPage from './pages/GuestDeliveryTrackingPage';
import HomePage from './pages/HomePage';
import RewardsMarketplacePage from './pages/RewardsMarketplacePage';
import PointsHistoryPage from './pages/PointsHistoryPage';
import LeaderboardPage from './pages/LeaderboardPage';
import AdminCampaignPage from './pages/AdminCampaignPage';
import ProofOfDeliveryPage from './pages/ProofOfDeliveryPage';
import NotificationPreferencesPage from './pages/NotificationPreferencesPage';
import DeliverySchedulingPage from './pages/DeliverySchedulingPage';
import DeliveryPreferencesPage from './pages/DeliveryPreferencesPage';
import AdminBulkMessagingPage from './pages/AdminBulkMessagingPage';
import AdminPromotionBannersPage from './pages/AdminPromotionBannersPage';
import AdminRateLimitingPage from './pages/AdminRateLimitingPage';
import './App.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <DeliveryProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/guest/request" element={<GuestRequestDeliveryPage />} />
            <Route path="/guest/delivery/:deliveryId" element={<GuestDeliveryTrackingPage />} />

            {/* Protected routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />

            {/* Customer routes */}
            <Route
              path="/request-delivery"
              element={
                <ProtectedRoute requiredRole="customer">
                  <RequestDeliveryPage />
                </ProtectedRoute>
              }
            />

            {/* Driver routes */}
            <Route
              path="/available-deliveries"
              element={
                <ProtectedRoute requiredRole="driver">
                  <AvailableDeliveriesPage />
                </ProtectedRoute>
              }
            />

            {/* Shared routes */}
            <Route
              path="/delivery/:id"
              element={
                <ProtectedRoute>
                  <DeliveryDetailPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/delivery/:deliveryId/proof-of-delivery"
              element={
                <ProtectedRoute requiredRole="driver">
                  <ProofOfDeliveryPage />
                </ProtectedRoute>
              }
            />

            {/* Admin routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboardPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminUsersPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/deliveries"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDeliveriesPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/reviews"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminReviewsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/campaigns"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminCampaignPage />
                </ProtectedRoute>
              }
            />

            {/* Points and Rewards routes */}
            <Route
              path="/rewards"
              element={
                <ProtectedRoute>
                  <RewardsMarketplacePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/rewards/history"
              element={
                <ProtectedRoute>
                  <RewardsMarketplacePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/points/history"
              element={
                <ProtectedRoute>
                  <PointsHistoryPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/leaderboard"
              element={
                <ProtectedRoute>
                  <LeaderboardPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/notification-preferences"
              element={
                <ProtectedRoute>
                  <NotificationPreferencesPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/schedule-delivery"
              element={
                <ProtectedRoute requiredRole="customer">
                  <DeliverySchedulingPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/delivery-preferences"
              element={
                <ProtectedRoute>
                  <DeliveryPreferencesPage />
                </ProtectedRoute>
              }
            />

            {/* Admin routes */}
            <Route
              path="/admin/bulk-messaging"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminBulkMessagingPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/promotion-banners"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminPromotionBannersPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/rate-limiting"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminRateLimitingPage />
                </ProtectedRoute>
              }
            />

            {/* Driver routes */}
            <Route
              path="/driver/analytics"
              element={
                <ProtectedRoute requiredRole="driver">
                  <DriverDashboardPage />
                </ProtectedRoute>
              }
            />

            {/* Home page - show for all users */}
            <Route path="/" element={<HomePage />} />

            {/* 404 - Not found */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </DeliveryProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
