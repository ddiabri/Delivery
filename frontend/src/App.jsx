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
