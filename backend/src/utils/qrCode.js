import crypto from 'crypto';
import QRCode from 'qrcode';

/**
 * Generate unique QR code token for delivery
 */
export const generateQRToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Generate QR code data URL (base64 image)
 */
export const generateQRCode = async (data) => {
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.95,
      margin: 1,
      width: 300,
    });
    return qrCodeDataUrl;
  } catch (err) {
    console.error('QR Code generation error:', err);
    throw err;
  }
};

/**
 * Generate QR code as SVG string
 */
export const generateQRCodeSVG = async (data) => {
  try {
    const svg = await QRCode.toString(data, {
      errorCorrectionLevel: 'H',
      type: 'image/svg+xml',
      quality: 0.95,
      margin: 1,
      width: 300,
    });
    return svg;
  } catch (err) {
    console.error('QR Code SVG generation error:', err);
    throw err;
  }
};

/**
 * Create QR code for delivery with delivery ID and token
 */
export const createDeliveryQRCode = async (deliveryId, qrToken) => {
  const qrData = JSON.stringify({
    deliveryId,
    token: qrToken,
    timestamp: new Date().toISOString(),
  });

  return generateQRCode(qrData);
};

/**
 * Verify QR token
 */
export const verifyQRToken = (qrToken, expectedToken) => {
  if (!qrToken || !expectedToken) {
    return false;
  }

  // Use constant-time comparison to prevent timing attacks
  const qrBuffer = Buffer.from(qrToken);
  const expectedBuffer = Buffer.from(expectedToken);

  return crypto.timingSafeEqual(qrBuffer, expectedBuffer);
};

/**
 * Parse QR code data
 */
export const parseQRData = (qrDataString) => {
  try {
    const data = JSON.parse(qrDataString);
    return {
      deliveryId: data.deliveryId,
      token: data.token,
      timestamp: data.timestamp,
    };
  } catch (err) {
    console.error('QR data parsing error:', err);
    return null;
  }
};
