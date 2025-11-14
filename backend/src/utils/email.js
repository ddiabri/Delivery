import { pool } from '../config/database.js';

// Send email (logging only - implement with nodemailer, SendGrid, AWS SES, etc.)
export const sendEmail = async (email, subject, template, data = {}) => {
  try {
    console.log(`📧 Email sent to ${email} - ${subject}`);

    // Log to database
    await pool.query(
      `INSERT INTO email_logs (user_id, email, subject, template)
       VALUES ((SELECT id FROM users WHERE email = $1), $2, $3, $4)`,
      [email, email, subject, template]
    );

    // In production, integrate with:
    // - Nodemailer + SMTP
    // - SendGrid API
    // - AWS SES
    // - Mailgun API
    // Example with template data:
    // const html = await renderTemplate(template, data);
    // await transporter.sendMail({ to: email, subject, html });

    return true;
  } catch (err) {
    console.error('Email error:', err);
    return false;
  }
};

// Delivery notification emails
export const sendDeliveryNotifications = {
  requestConfirmation: (email, deliveryData) => {
    return sendEmail(email, '📦 Delivery Request Confirmed', 'delivery_confirmation', {
      customer: deliveryData.customer_name,
      pickup: deliveryData.pickup_address,
      delivery: deliveryData.delivery_address,
    });
  },

  driverAssigned: (email, driverData, deliveryData) => {
    return sendEmail(email, '🎉 Driver Assigned', 'driver_assigned', {
      customer: deliveryData.customer_name,
      driver: driverData.full_name,
      phone: driverData.phone,
    });
  },

  deliveryInTransit: (email, deliveryData) => {
    return sendEmail(email, '🚗 Your Delivery is In Transit', 'in_transit', {
      customer: deliveryData.customer_name,
      address: deliveryData.delivery_address,
    });
  },

  deliveryCompleted: (email, deliveryData) => {
    return sendEmail(email, '✓ Delivery Completed', 'delivery_completed', {
      customer: deliveryData.customer_name,
      deliveryId: deliveryData.id,
    });
  },

  driverNotification: (email, message, type) => {
    return sendEmail(email, `📋 ${message}`, 'driver_notification', { message, type });
  },
};
