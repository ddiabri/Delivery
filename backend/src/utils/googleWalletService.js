/**
 * Google Wallet Pass Generator
 * Creates JWT-based passes for Google Wallet
 */

import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Generate Google Wallet pass link
 * Returns a URL to add the pass to Google Wallet
 */
export const generateGoogleWalletPass = async (
  driverId,
  driverName,
  driverRating,
  profileImageUrl = null
) => {
  try {
    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(
      JSON.stringify({
        type: 'driver_referral',
        driverId,
        driverName,
        driverRating,
        timestamp: new Date().toISOString(),
      }),
      {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        quality: 0.95,
        margin: 1,
        width: 400,
      }
    );

    // Create generic pass object for Google Wallet
    const passObject = {
      id: `${process.env.GOOGLE_WALLET_ISSUER_ID}.driver-${driverId}-${Date.now()}`,
      classId: `${process.env.GOOGLE_WALLET_ISSUER_ID}.driver_profile`,
      state: 'ACTIVE',
      heroImage: {
        sourceUri: {
          uri: profileImageUrl || 'https://via.placeholder.com/1200x400?text=Driver+Profile',
        },
      },
      textModulesData: [
        {
          header: 'Driver Information',
          body: `${driverName} • ${driverRating.toFixed(1)} ⭐`,
        },
        {
          header: 'About This Pass',
          body: 'Customers can scan your QR code to request deliveries. Share your pass for easy booking.',
        },
      ],
      barcode: {
        type: 'QR_CODE',
        value: JSON.stringify({
          type: 'driver_referral',
          driverId,
          driverName,
          driverRating,
          timestamp: new Date().toISOString(),
        }),
      },
      cardTitle: {
        defaultValue: {
          language: 'en',
          value: `${driverName} - Delivery Driver`,
        },
      },
      subheader: {
        defaultValue: {
          language: 'en',
          value: `Rating: ${driverRating.toFixed(1)} ⭐`,
        },
      },
      logo: {
        sourceUri: {
          uri: 'https://via.placeholder.com/150x150?text=Logo',
        },
      },
      // Custom fields
      customTextModules: [
        {
          id: 'driver_id',
          header: 'Driver ID',
          body: driverId.substring(0, 8).toUpperCase(),
        },
        {
          id: 'rating',
          header: 'Average Rating',
          body: `${driverRating.toFixed(1)} / 5.0 ⭐`,
        },
      ],
      linksModuleData: {
        uris: [
          {
            uri: `https://deliveryapp.example.com/driver/${driverId}`,
            description: 'View My Profile',
            id: 'profile_link',
          },
          {
            uri: `tel:+1234567890`, // Would be replaced with actual phone
            description: 'Contact Driver',
            id: 'contact_link',
          },
        ],
      },
      // Expiration date (1 year)
      validTimeInterval: {
        start: {
          date: new Date().toISOString().split('T')[0],
        },
        end: {
          date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
        },
      },
      // Color branding
      hexBackgroundColor: '#4C7EF5', // Brand color
    };

    // Create JWT payload
    const claims = {
      iss: process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL,
      aud: 'google',
      typ: 'savetowallet',
      payload: {
        genericObjects: [passObject],
      },
    };

    // Sign JWT with service account private key
    const privateKey = process.env.GOOGLE_WALLET_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!privateKey) {
      console.warn('[Google Wallet] Private key not configured. Using demo mode.');
      // Return demo URL without real JWT
      return {
        success: false,
        message: 'Google Wallet integration requires configuration',
        demoUrl: `https://wallet.google.com/save?jwt=demo_jwt`,
      };
    }

    const token = jwt.sign(claims, privateKey, {
      algorithm: 'RS256',
      expiresIn: '2h',
    });

    // Return Google Wallet add URL
    return {
      success: true,
      message: 'Google Wallet pass created successfully',
      url: `https://wallet.google.com/save?jwt=${token}`,
      token, // For debugging
    };
  } catch (error) {
    console.error('Error generating Google Wallet pass:', error);
    throw new Error('Failed to generate Google Wallet pass');
  }
};

/**
 * Get Google Wallet configuration status
 */
export const getGoogleWalletConfig = () => {
  const configured =
    !!process.env.GOOGLE_WALLET_ISSUER_ID &&
    !!process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL &&
    !!process.env.GOOGLE_WALLET_PRIVATE_KEY;

  return {
    configured,
    issuerIdSet: !!process.env.GOOGLE_WALLET_ISSUER_ID,
    serviceAccountSet: !!process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL,
    privateKeySet: !!process.env.GOOGLE_WALLET_PRIVATE_KEY,
    message: configured
      ? 'Google Wallet is fully configured'
      : 'Google Wallet requires additional configuration in .env',
  };
};

/**
 * Validate Google Wallet configuration
 */
export const validateGoogleWalletConfig = () => {
  const required = [
    'GOOGLE_WALLET_ISSUER_ID',
    'GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL',
    'GOOGLE_WALLET_PRIVATE_KEY',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.warn('[Google Wallet] Missing configuration:', missing);
    return false;
  }

  return true;
};
