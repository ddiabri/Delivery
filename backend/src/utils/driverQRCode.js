import QRCode from 'qrcode';

/**
 * Generate QR code for driver profile/referral
 * Encodes: driver ID, name, and rating for easy referral
 */
export const generateDriverQRCode = async (driverId, driverName, driverRating = 0) => {
  try {
    // Create JSON data to encode in QR code
    const driverData = {
      type: 'driver_referral',
      driverId,
      driverName,
      driverRating,
      timestamp: new Date().toISOString(),
    };

    const qrDataString = JSON.stringify(driverData);

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(qrDataString, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.95,
      margin: 1,
      width: 300,
    });

    return qrCodeDataUrl;
  } catch (error) {
    console.error('Error generating driver QR code:', error);
    throw new Error('Failed to generate driver QR code');
  }
};

/**
 * Generate SVG format QR code for driver profile
 * Useful for printing or embedding in HTML
 */
export const generateDriverQRCodeSVG = async (driverId, driverName, driverRating = 0) => {
  try {
    const driverData = {
      type: 'driver_referral',
      driverId,
      driverName,
      driverRating,
      timestamp: new Date().toISOString(),
    };

    const qrDataString = JSON.stringify(driverData);

    const qrCodeSVG = await QRCode.toString(qrDataString, {
      errorCorrectionLevel: 'H',
      type: 'image/svg+xml',
      quality: 0.95,
      margin: 1,
      width: 300,
    });

    return qrCodeSVG;
  } catch (error) {
    console.error('Error generating driver QR code SVG:', error);
    throw new Error('Failed to generate driver QR code SVG');
  }
};

/**
 * Parse QR code data scanned by client
 * Returns the driver ID and information
 */
export const parseDriverQRData = (qrDataString) => {
  try {
    const data = JSON.parse(qrDataString);

    if (data.type !== 'driver_referral') {
      throw new Error('Invalid QR code type');
    }

    if (!data.driverId) {
      throw new Error('Missing driver ID in QR code');
    }

    return {
      driverId: data.driverId,
      driverName: data.driverName,
      driverRating: data.driverRating,
    };
  } catch (error) {
    console.error('Error parsing driver QR data:', error);
    throw new Error('Invalid driver QR code');
  }
};

/**
 * Verify if driver exists and is active
 * Called after parsing QR code to validate driver
 */
export const verifyDriverQRData = (driverId, expectedRole = 'driver') => {
  if (!driverId) {
    throw new Error('Driver ID is required');
  }

  // Basic validation - actual database verification happens in controller
  if (typeof driverId !== 'string' || driverId.length === 0) {
    throw new Error('Invalid driver ID format');
  }

  return true;
};
