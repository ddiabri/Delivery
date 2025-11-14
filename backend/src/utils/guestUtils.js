import crypto from 'crypto';

/**
 * Generate unique token for guest delivery tracking
 * Used to identify and track guest deliveries without authentication
 */
export const generateGuestToken = () => {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
};

/**
 * Validate guest information
 */
export const validateGuestInfo = (guestName, guestEmail, guestPhone) => {
  const errors = [];

  if (!guestName || guestName.trim().length === 0) {
    errors.push('Guest name is required');
  }

  if (!guestPhone || guestPhone.trim().length === 0) {
    errors.push('Guest phone is required');
  }

  if (guestEmail && guestEmail.trim().length > 0) {
    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guestEmail)) {
      errors.push('Invalid email format');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Format guest info for display
 */
export const formatGuestInfo = (guestName, guestEmail, guestPhone) => {
  return {
    name: guestName,
    email: guestEmail || 'Not provided',
    phone: guestPhone,
  };
};

/**
 * Generate guest tracking link
 * Used to share tracking info with guest (via SMS/email)
 */
export const generateGuestTrackingLink = (deliveryId, guestToken) => {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  return `${baseUrl}/guest/delivery/${deliveryId}?token=${guestToken}`;
};
