import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import '../styles/proofOfDelivery.css';

export default function ProofOfDeliveryPage() {
  const navigate = useNavigate();
  const { deliveryId } = useParams();
  const { user } = useAuth();
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    notes: '',
    latitude: null,
    longitude: null,
  });

  const [photos, setPhotos] = useState([]);
  const [signature, setSignature] = useState(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (user?.role !== 'driver') {
      navigate('/dashboard');
      return;
    }

    fetchDelivery();
    getLocation();
  }, [user?.role, deliveryId]);

  const fetchDelivery = async () => {
    try {
      const response = await fetch(`/api/deliveries/${deliveryId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch delivery');

      const data = await response.json();
      setDelivery(data.delivery);

      if (data.delivery.driver_id !== user?.id) {
        navigate('/dashboard');
        return;
      }
    } catch (err) {
      setError('Failed to load delivery');
    } finally {
      setLoading(false);
    }
  };

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setFormData((prev) => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }));
      });
    }
  };

  const handlePhotoCapture = (e) => {
    const files = Array.from(e.target.files || []);
    setPhotos((prev) => [...prev, ...files]);
  };

  const handleRemovePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleNotesChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      notes: e.target.value,
    }));
  };

  const initSignatureCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
  };

  useEffect(() => {
    initSignatureCanvas();
  }, []);

  const handleSignatureStart = (e) => {
    setIsDrawing(true);
    drawSignature(e);
  };

  const handleSignatureMove = (e) => {
    if (!isDrawing) return;
    drawSignature(e);
  };

  const handleSignatureEnd = () => {
    setIsDrawing(false);
  };

  const drawSignature = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDrawing) {
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (photos.length === 0) {
      setError('Please upload at least one photo');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const formPayload = new FormData();
      formPayload.append('notes', formData.notes);
      formPayload.append('latitude', formData.latitude);
      formPayload.append('longitude', formData.longitude);

      // Append photos
      photos.forEach((photo, index) => {
        formPayload.append(`photo_${index}`, photo);
      });

      // Append signature if available
      if (canvasRef.current) {
        const signatureImage = canvasRef.current.toDataURL('image/png');
        formPayload.append('signature', signatureImage);
      }

      const response = await fetch(`/api/pod/${deliveryId}/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: formPayload,
      });

      if (!response.ok) throw new Error('Failed to submit proof of delivery');

      const result = await response.json();
      navigate(`/delivery/${deliveryId}`, {
        state: { podSubmitted: true, message: 'Proof of delivery submitted successfully!' },
      });
    } catch (err) {
      setError(err.message || 'Failed to submit proof of delivery');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="pod-page">
        <div className="loading">Loading delivery details...</div>
      </div>
    );
  }

  if (error && !delivery) {
    return (
      <div className="pod-page">
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="pod-page">
        <div className="error-message">
          <p>Delivery not found</p>
          <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pod-page">
      <header className="page-header">
        <h1>📸 Proof of Delivery</h1>
        <button className="btn-back" onClick={() => navigate(`/delivery/${deliveryId}`)}>
          ← Back
        </button>
      </header>

      <main className="pod-container">
        <div className="pod-card">
          <div className="delivery-info">
            <h2>Delivery Details</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">From:</span>
                <span className="value">{delivery.pickup_address}</span>
              </div>
              <div className="info-item">
                <span className="label">To:</span>
                <span className="value">{delivery.delivery_address}</span>
              </div>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit} className="pod-form">
            {/* Photo Upload Section */}
            <section className="form-section">
              <h3>📷 Photos</h3>
              <p className="section-description">
                Upload clear photos of the package and delivery location
              </p>

              <div className="photo-upload">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoCapture}
                  style={{ display: 'none' }}
                  capture="environment"
                />
                <button
                  type="button"
                  className="btn-upload"
                  onClick={() => fileInputRef.current?.click()}
                >
                  📸 Capture or Upload Photos
                </button>
              </div>

              {photos.length > 0 && (
                <div className="photo-list">
                  <p className="photo-count">{photos.length} photo(s) selected</p>
                  <div className="photo-items">
                    {photos.map((photo, index) => (
                      <div key={index} className="photo-item">
                        <span className="photo-name">
                          {typeof photo === 'string' ? `Photo ${index + 1}` : photo.name}
                        </span>
                        <button
                          type="button"
                          className="btn-remove"
                          onClick={() => handleRemovePhoto(index)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Signature Section */}
            <section className="form-section">
              <h3>✍️ Signature (Optional)</h3>
              <p className="section-description">
                Get customer signature for proof of delivery
              </p>

              <div className="signature-canvas-container">
                <canvas
                  ref={canvasRef}
                  className="signature-canvas"
                  onMouseDown={handleSignatureStart}
                  onMouseMove={handleSignatureMove}
                  onMouseUp={handleSignatureEnd}
                  onMouseLeave={handleSignatureEnd}
                />
              </div>

              <button type="button" className="btn-clear-signature" onClick={clearSignature}>
                Clear Signature
              </button>
            </section>

            {/* Notes Section */}
            <section className="form-section">
              <h3>📝 Notes</h3>
              <p className="section-description">
                Add any additional details about the delivery
              </p>

              <textarea
                value={formData.notes}
                onChange={handleNotesChange}
                placeholder="e.g., Package left at door, Signed by recipient, etc."
                rows={4}
                className="notes-textarea"
              />
            </section>

            {/* Location Info */}
            <section className="form-section location-info">
              <h3>📍 Location</h3>
              <p className="section-description">
                {formData.latitude && formData.longitude
                  ? `Captured at: ${formData.latitude.toFixed(6)}, ${formData.longitude.toFixed(6)}`
                  : 'Location not captured - please enable location services'}
              </p>
            </section>

            {/* Submit Button */}
            <div className="form-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => navigate(`/delivery/${deliveryId}`)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-submit"
                disabled={submitting || photos.length === 0}
              >
                {submitting ? 'Submitting...' : '✓ Submit Proof of Delivery'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
