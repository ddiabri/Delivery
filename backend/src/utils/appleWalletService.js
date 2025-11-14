/**
 * Apple Wallet (.pkpass) Pass Generator
 * Creates Passbook compatible pass files for drivers
 */

import QRCode from 'qrcode';
import archiver from 'archiver';
import crypto from 'crypto';
import { Readable } from 'stream';

/**
 * Generate Apple Wallet pass (.pkpass file)
 * Returns a stream that can be piped to response
 */
export const generateAppleWalletPass = async (
  driverId,
  driverName,
  driverRating,
  profileImageUrl = null
) => {
  try {
    // Generate QR code as PNG buffer
    const qrCodeBuffer = await QRCode.toBuffer(
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

    // Create pass.json
    const passJson = {
      formatVersion: 1,
      passTypeIdentifier: 'pass.com.deliveryapp.driver',
      serialNumber: `driver-${driverId}-${Date.now()}`,
      teamIdentifier: 'DELIVERY_APP', // Replace with your team ID in production
      organizationName: 'Delivery App',
      description: `${driverName} - Delivery Driver Profile`,

      // Generic pass type for QR code display
      generic: {
        primaryFields: [
          {
            key: 'driverName',
            label: 'Driver',
            value: driverName,
          },
        ],
        secondaryFields: [
          {
            key: 'driverId',
            label: 'ID',
            value: driverId.substring(0, 8),
          },
          {
            key: 'rating',
            label: 'Rating',
            value: `${driverRating.toFixed(1)} ⭐`,
          },
        ],
        auxiliaryFields: [
          {
            key: 'scanInfo',
            label: 'Scan this QR code',
            value: 'to request delivery',
          },
        ],
        backFields: [
          {
            key: 'about',
            label: 'About This Pass',
            value: 'This pass contains your driver profile QR code. Customers can scan it to request deliveries from you.',
          },
          {
            key: 'instructions',
            label: 'How to Use',
            value: 'Add this pass to your Apple Wallet for easy sharing. Customers can scan the QR code to request deliveries.',
          },
        ],
      },

      // Barcode configuration (for QR code)
      barcodes: [
        {
          format: 'PKBarcodeFormatQR',
          message: JSON.stringify({
            type: 'driver_referral',
            driverId,
            driverName,
            driverRating,
            timestamp: new Date().toISOString(),
          }),
          messageEncoding: 'iso-8859-1',
        },
      ],

      // URLs and branding
      appLaunchURL: `deliveryapp://driver/${driverId}`,
      associatedStoreIdentifiers: [123456789], // Replace with your app store ID
      webServiceURL: 'https://deliveryapp.example.com/api/',
      authenticationToken: `auth-${driverId}-${Date.now()}`,

      // Styling
      backgroundColor: 'rgb(76, 126, 245)', // Brand color
      foregroundColor: 'rgb(255, 255, 255)',
      labelColor: 'rgb(255, 255, 255)',

      // Locations (optional - for geofence notifications)
      locations: [
        {
          latitude: 37.7749,
          longitude: -122.4194,
          relevantText: 'Delivery Service Area',
        },
      ],

      // Relevance
      relevantDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
    };

    // Create archive
    const archive = archiver('zip', {
      zlib: { level: 9 },
    });

    // Add files to archive
    archive.append(JSON.stringify(passJson, null, 2), { name: 'pass.json' });
    archive.append(qrCodeBuffer, { name: 'strip@2x.png' });

    // Add placeholder icon (simple colored square)
    const iconBuffer = await createPlaceholderIcon(76, 'rgb(76, 126, 245)');
    archive.append(iconBuffer, { name: 'icon.png' });
    archive.append(iconBuffer, { name: 'icon@2x.png' });

    // Create manifest (list of files)
    const manifest = {
      'pass.json': hashSHA1(JSON.stringify(passJson, null, 2)),
      'strip@2x.png': hashSHA1(qrCodeBuffer),
      'icon.png': hashSHA1(iconBuffer),
      'icon@2x.png': hashSHA1(iconBuffer),
    };

    archive.append(JSON.stringify(manifest), { name: 'manifest.json' });

    // Note: In production, you would sign the manifest.json here
    // For development, we skip the signature file
    // const signature = signManifest(manifest, privateKey, certificate);
    // archive.append(signature, { name: 'signature' });

    await archive.finalize();
    return archive;
  } catch (error) {
    console.error('Error generating Apple Wallet pass:', error);
    throw new Error('Failed to generate Apple Wallet pass');
  }
};

/**
 * Create a simple placeholder icon PNG
 */
const createPlaceholderIcon = async (size, color) => {
  // For simplicity, we'll create a minimal PNG using canvas-like approach
  // In production, you'd use a real image library
  return Buffer.from('dummy'); // Placeholder - would be replaced with actual PNG
};

/**
 * SHA1 hash for manifest
 */
const hashSHA1 = (data) => {
  return crypto.createHash('sha1').update(data).digest('hex');
};

/**
 * Sign manifest.json (requires certificate and private key)
 * This is required for production use
 */
export const signManifest = (manifest, privateKey, certificate) => {
  try {
    // Create PKCS#7 signature
    // This requires openssl or node crypto modules
    // Simplified version shown - full implementation would use proper PKCS#7
    const manifestString = JSON.stringify(manifest);
    const signature = crypto
      .createSign('RSA-SHA1')
      .update(manifestString)
      .sign(privateKey);

    return signature;
  } catch (error) {
    console.error('Error signing manifest:', error);
    throw new Error('Failed to sign manifest');
  }
};
