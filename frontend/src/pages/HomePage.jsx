import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import '../styles/home.css';

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (user) {
    // Redirect authenticated users to dashboard
    navigate('/dashboard');
    return null;
  }

  return (
    <div className="home-page">
      <header className="hero-header">
        <div className="hero-content">
          <h1>📦 Fast & Reliable Delivery Service</h1>
          <p>Get your packages delivered on time, every time</p>
        </div>
      </header>

      <main className="home-container">
        <section className="options-section">
          <h2>How would you like to proceed?</h2>

          <div className="options-grid">
            {/* Guest Option */}
            <div className="option-card guest-option">
              <div className="option-icon">👤</div>
              <h3>Request as Guest</h3>
              <p>No account needed. Request a delivery quickly and track it with a token.</p>
              <button
                className="btn-option btn-guest"
                onClick={() => navigate('/guest/request')}
              >
                Request Delivery as Guest
              </button>
            </div>

            {/* Sign In Option */}
            <div className="option-card signin-option">
              <div className="option-icon">🔐</div>
              <h3>Sign In to Account</h3>
              <p>Log in to your account to manage multiple deliveries and track history.</p>
              <button
                className="btn-option btn-signin"
                onClick={() => navigate('/login')}
              >
                Sign In
              </button>
            </div>

            {/* Register Option */}
            <div className="option-card register-option">
              <div className="option-icon">✨</div>
              <h3>Create New Account</h3>
              <p>Join our platform to get exclusive features and rewards.</p>
              <button
                className="btn-option btn-register"
                onClick={() => navigate('/register')}
              >
                Create Account
              </button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="features-section">
          <h2>Why Choose Us?</h2>
          <div className="features-grid">
            <div className="feature">
              <div className="feature-icon">⚡</div>
              <h4>Fast Delivery</h4>
              <p>Same-day delivery available in most areas</p>
            </div>
            <div className="feature">
              <div className="feature-icon">🛡️</div>
              <h4>Safe & Secure</h4>
              <p>Your packages are handled with care</p>
            </div>
            <div className="feature">
              <div className="feature-icon">📍</div>
              <h4>Real-time Tracking</h4>
              <p>Track your delivery every step of the way</p>
            </div>
            <div className="feature">
              <div className="feature-icon">💰</div>
              <h4>Affordable Prices</h4>
              <p>Competitive pricing for all delivery needs</p>
            </div>
            <div className="feature">
              <div className="feature-icon">👥</div>
              <h4>Professional Drivers</h4>
              <p>Experienced and rated delivery drivers</p>
            </div>
            <div className="feature">
              <div className="feature-icon">24/7</div>
              <h4>Always Available</h4>
              <p>Request deliveries anytime, day or night</p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta-section">
          <h2>Ready to Send a Package?</h2>
          <p>Start your delivery request now - no account required!</p>
          <button
            className="btn-primary-large"
            onClick={() => navigate('/guest/request')}
          >
            Request Delivery Now
          </button>
        </section>
      </main>

      <footer className="footer">
        <p>&copy; 2024 Delivery Service. All rights reserved.</p>
      </footer>
    </div>
  );
}
