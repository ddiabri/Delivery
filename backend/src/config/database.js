import pkg from 'pg';
const { Client, Pool } = pkg;
import dotenv from 'dotenv';
import { walletSchemaSQL } from './wallet-schema.js';

dotenv.config();

// Create a connection pool
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'delivery_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
  max: 20, // Connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

// Test connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database connection successful:', result.rows[0]);
    client.release();
    return true;
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    return false;
  }
};

// Initialize database (create extensions and tables)
const initializeDatabase = async () => {
  const client = await pool.connect();
  try {
    // Enable PostGIS extension
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    console.log('✅ PostGIS extension enabled');

    // Enable UUID extension
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    console.log('✅ UUID extension enabled');

    // Create tables
    await createTables(client);

  } catch (err) {
    console.error('❌ Database initialization failed:', err);
  } finally {
    client.release();
  }
};

const createTables = async (client) => {
  try {
    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        role VARCHAR(50) NOT NULL CHECK (role IN ('customer', 'driver', 'admin')),
        address TEXT,
        location GEOGRAPHY(POINT, 4326),
        profile_image_url TEXT,
        average_rating DECIMAL(3, 2) DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Users table created');

    // Deliveries table
    await client.query(`
      CREATE TABLE IF NOT EXISTS deliveries (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
        driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
        pickup_address TEXT NOT NULL,
        pickup_location GEOGRAPHY(POINT, 4326) NOT NULL,
        delivery_address TEXT NOT NULL,
        delivery_location GEOGRAPHY(POINT, 4326) NOT NULL,
        package_description TEXT,
        package_weight DECIMAL(10, 2),
        package_dimensions TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN (
          'PENDING', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'
        )),
        priority VARCHAR(50) DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
        qr_code_token VARCHAR(100) UNIQUE,
        qr_code_scanned_at TIMESTAMP,
        qr_code_scanned_by UUID REFERENCES users(id) ON DELETE SET NULL,
        guest_name VARCHAR(255),
        guest_email VARCHAR(255),
        guest_phone VARCHAR(20),
        guest_token VARCHAR(100) UNIQUE,
        scheduled_pickup_time TIMESTAMP,
        scheduled_delivery_time TIMESTAMP,
        estimated_delivery_time TIMESTAMP,
        actual_delivery_time TIMESTAMP,
        special_instructions TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Deliveries table created');

    // Driver Location Tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS driver_locations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        location GEOGRAPHY(POINT, 4326) NOT NULL,
        bearing DECIMAL(5, 2),
        speed DECIMAL(6, 2),
        accuracy DECIMAL(6, 2),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(driver_id, timestamp)
      );
    `);
    console.log('✅ Driver Locations table created');

    // Delivery Rating/Reviews table
    await client.query(`
      CREATE TABLE IF NOT EXISTS delivery_reviews (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
        customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        is_anonymous BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Delivery Reviews table created');

    // Messages/Chat table
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message_text TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Messages table created');

    // Notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Notifications table created');

    // Email Logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        template VARCHAR(50) NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Email Logs table created');

    // Marketing Campaigns table
    await client.query(`
      CREATE TABLE IF NOT EXISTS marketing_campaigns (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        campaign_name VARCHAR(255) NOT NULL,
        description TEXT,
        campaign_type VARCHAR(50) NOT NULL CHECK (campaign_type IN ('BONUS', 'MULTIPLIER', 'REFERRAL', 'SEASONAL', 'VIP', 'EVENT')),
        target_user_type VARCHAR(50) NOT NULL CHECK (target_user_type IN ('ALL', 'NEW_USERS', 'VIP', 'DRIVERS', 'CUSTOMERS', 'INACTIVE')),
        point_multiplier DECIMAL(3, 2) DEFAULT 1.0,
        conditions JSONB,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT true,
        is_stackable BOOLEAN DEFAULT false,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Marketing Campaigns table created');

    // Campaign Rules table
    await client.query(`
      CREATE TABLE IF NOT EXISTS campaign_rules (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
        action_type VARCHAR(100) NOT NULL,
        base_points INTEGER NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Campaign Rules table created');

    // User Campaigns table (User enrollments in campaigns)
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_campaigns (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
        enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        UNIQUE(user_id, campaign_id)
      );
    `);
    console.log('✅ User Campaigns table created');

    // User Points table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_points (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        current_points INTEGER DEFAULT 0,
        lifetime_points INTEGER DEFAULT 0,
        tier_level VARCHAR(50) DEFAULT 'BRONZE' CHECK (tier_level IN ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM')),
        tier_expires_at TIMESTAMP,
        last_activity_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ User Points table created');

    // Points Transactions table (Audit trail)
    await client.query(`
      CREATE TABLE IF NOT EXISTS points_transactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
        delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
        action_type VARCHAR(100) NOT NULL,
        points_earned INTEGER,
        points_spent INTEGER,
        reason TEXT,
        description TEXT,
        multiplier_applied DECIMAL(3, 2) DEFAULT 1.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Points Transactions table created');

    // Rewards Catalog table
    await client.query(`
      CREATE TABLE IF NOT EXISTS rewards_catalog (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
        reward_name VARCHAR(255) NOT NULL,
        description TEXT,
        point_cost INTEGER NOT NULL,
        reward_type VARCHAR(50) NOT NULL CHECK (reward_type IN ('DISCOUNT', 'CREDIT', 'BADGE', 'ACCESS', 'FREE_DELIVERY')),
        reward_value VARCHAR(255),
        availability VARCHAR(50) DEFAULT 'UNLIMITED' CHECK (availability IN ('LIMITED', 'UNLIMITED')),
        quantity_available INTEGER,
        quantity_redeemed INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Rewards Catalog table created');

    // User Rewards Redeemed table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_rewards_redeemed (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reward_id UUID NOT NULL REFERENCES rewards_catalog(id) ON DELETE CASCADE,
        points_spent INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT 'REDEEMED' CHECK (status IN ('REDEEMED', 'USED', 'EXPIRED')),
        redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        used_at TIMESTAMP,
        expires_at TIMESTAMP,
        reference_code VARCHAR(50)
      );
    `);
    console.log('✅ User Rewards Redeemed table created');

    // Proof of Delivery table
    await client.query(`
      CREATE TABLE IF NOT EXISTS proof_of_delivery (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        delivery_id UUID NOT NULL UNIQUE REFERENCES deliveries(id) ON DELETE CASCADE,
        photo_url VARCHAR(500),
        signature_url VARCHAR(500),
        notes TEXT,
        delivery_lat DECIMAL(10, 8),
        delivery_lon DECIMAL(11, 8),
        verified_at TIMESTAMP,
        verified_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Proof of Delivery table created');

    // User Notification Preferences table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_notification_preferences (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        phone_number VARCHAR(20),
        phone_verified BOOLEAN DEFAULT false,
        phone_verified_at TIMESTAMP,
        email_notifications BOOLEAN DEFAULT true,
        sms_notifications BOOLEAN DEFAULT false,
        whatsapp_notifications BOOLEAN DEFAULT false,
        in_app_notifications BOOLEAN DEFAULT true,
        browser_notifications BOOLEAN DEFAULT true,
        delivery_status_updates BOOLEAN DEFAULT true,
        points_alerts BOOLEAN DEFAULT true,
        promotional BOOLEAN DEFAULT false,
        weekly_digest BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ User Notification Preferences table created');

    // Notification Delivery Logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_delivery_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
        delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
        channel VARCHAR(50) NOT NULL CHECK (channel IN ('EMAIL', 'SMS', 'WHATSAPP', 'IN_APP', 'BROWSER')),
        status VARCHAR(50) NOT NULL CHECK (status IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED')),
        message_type VARCHAR(100),
        recipient VARCHAR(255),
        message_content TEXT,
        error_message TEXT,
        external_id VARCHAR(255),
        sent_at TIMESTAMP,
        delivered_at TIMESTAMP,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Notification Delivery Logs table created');

    // Phone Verification Tokens table
    await client.query(`
      CREATE TABLE IF NOT EXISTS phone_verification_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        phone_number VARCHAR(20) NOT NULL,
        token VARCHAR(6) NOT NULL,
        verified BOOLEAN DEFAULT false,
        attempts INT DEFAULT 0,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Phone Verification Tokens table created');

    // Scheduled Deliveries table
    await client.query(`
      CREATE TABLE IF NOT EXISTS scheduled_deliveries (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
        pickup_address TEXT NOT NULL,
        pickup_location GEOGRAPHY(POINT, 4326) NOT NULL,
        delivery_address TEXT NOT NULL,
        delivery_location GEOGRAPHY(POINT, 4326) NOT NULL,
        package_description TEXT,
        package_weight DECIMAL(10, 2),
        package_dimensions TEXT,
        priority VARCHAR(50) DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
        scheduled_pickup_time TIMESTAMP NOT NULL,
        scheduled_delivery_time TIMESTAMP NOT NULL,
        special_instructions TEXT,
        status VARCHAR(50) DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'CONFIRMED', 'CANCELLED', 'CONVERTED')),
        converted_delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Scheduled Deliveries table created');

    // Delivery Preferences table
    await client.query(`
      CREATE TABLE IF NOT EXISTS delivery_preferences (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        user_type VARCHAR(50) NOT NULL CHECK (user_type IN ('customer', 'driver')),
        preferred_days_of_week JSONB DEFAULT '["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]',
        preferred_time_windows JSONB DEFAULT '[{"start": "08:00", "end": "18:00"}]',
        excluded_locations JSONB DEFAULT '[]',
        preferred_locations JSONB DEFAULT '[]',
        max_weight_preference DECIMAL(10, 2),
        delivery_radius_km DECIMAL(10, 2),
        require_signature BOOLEAN DEFAULT true,
        allow_cash_payment BOOLEAN DEFAULT false,
        special_instructions TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Delivery Preferences table created');

    // Promotion Banners table
    await client.query(`
      CREATE TABLE IF NOT EXISTS promotion_banners (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        image_url VARCHAR(500),
        background_color VARCHAR(20),
        text_color VARCHAR(20),
        banner_type VARCHAR(50) NOT NULL CHECK (banner_type IN ('DISCOUNT', 'POINTS_BONUS', 'FREE_DELIVERY', 'NEW_FEATURE', 'ANNOUNCEMENT')),
        target_user_type VARCHAR(50) NOT NULL CHECK (target_user_type IN ('ALL', 'CUSTOMER', 'DRIVER')),
        call_to_action_text VARCHAR(100),
        call_to_action_link VARCHAR(500),
        is_active BOOLEAN DEFAULT true,
        priority INTEGER DEFAULT 0,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        dismissed_by_users JSONB DEFAULT '[]',
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Promotion Banners table created');

    // Bulk Messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bulk_messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
        created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message_type VARCHAR(50) NOT NULL CHECK (message_type IN ('SMS', 'WHATSAPP', 'EMAIL')),
        target_user_type VARCHAR(50) NOT NULL CHECK (target_user_type IN ('ALL', 'CUSTOMER', 'DRIVER', 'CUSTOM')),
        target_user_ids JSONB DEFAULT '[]',
        status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'QUEUED', 'SENDING', 'SENT', 'COMPLETED', 'FAILED')),
        message_subject VARCHAR(255),
        message_template VARCHAR(1000) NOT NULL,
        total_recipients INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        bounced_count INTEGER DEFAULT 0,
        scheduled_send_time TIMESTAMP,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Bulk Messages table created');

    // Create wallet-related tables
    await client.query(walletSchemaSQL);
    console.log('✅ Wallet tables created');

    // Rate Limit Tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS rate_limit_tracking (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        ip_address VARCHAR(45),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        endpoint VARCHAR(500) NOT NULL,
        method VARCHAR(10) NOT NULL,
        request_count INTEGER DEFAULT 1,
        first_request_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_request_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_blocked BOOLEAN DEFAULT false,
        block_until TIMESTAMP,
        block_reason VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Rate Limit Tracking table created');

    // IP Whitelist table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ip_whitelist (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        ip_address VARCHAR(45) NOT NULL UNIQUE,
        description VARCHAR(255),
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ IP Whitelist table created');

    // Rate Limit Analytics table
    await client.query(`
      CREATE TABLE IF NOT EXISTS rate_limit_analytics (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        endpoint VARCHAR(500) NOT NULL,
        method VARCHAR(10) NOT NULL,
        total_requests INTEGER DEFAULT 0,
        blocked_requests INTEGER DEFAULT 0,
        unique_ips INTEGER DEFAULT 0,
        unique_users INTEGER DEFAULT 0,
        avg_response_time DECIMAL(10, 2),
        date_recorded DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Rate Limit Analytics table created');

    // Create indexes for better query performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_deliveries_customer ON deliveries(customer_id);
      CREATE INDEX IF NOT EXISTS idx_deliveries_driver ON deliveries(driver_id);
      CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
      CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON deliveries(created_at);
      CREATE INDEX IF NOT EXISTS idx_driver_locations_driver ON driver_locations(driver_id);
      CREATE INDEX IF NOT EXISTS idx_driver_locations_timestamp ON driver_locations(timestamp);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_delivery_reviews_delivery ON delivery_reviews(delivery_id);
      CREATE INDEX IF NOT EXISTS idx_messages_delivery ON messages(delivery_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_messages_delivery_created ON messages(delivery_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_user_points_user ON user_points(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_points_tier ON user_points(tier_level);
      CREATE INDEX IF NOT EXISTS idx_points_transactions_user ON points_transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_points_transactions_campaign ON points_transactions(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_points_transactions_delivery ON points_transactions(delivery_id);
      CREATE INDEX IF NOT EXISTS idx_points_transactions_created ON points_transactions(created_at);
      CREATE INDEX IF NOT EXISTS idx_user_campaigns_user ON user_campaigns(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_campaigns_campaign ON user_campaigns(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_campaign_rules_campaign ON campaign_rules(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_active ON marketing_campaigns(is_active);
      CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_dates ON marketing_campaigns(start_date, end_date);
      CREATE INDEX IF NOT EXISTS idx_rewards_catalog_active ON rewards_catalog(is_active);
      CREATE INDEX IF NOT EXISTS idx_user_rewards_user ON user_rewards_redeemed(user_id);
      CREATE INDEX IF NOT EXISTS idx_pod_delivery ON proof_of_delivery(delivery_id);
      CREATE INDEX IF NOT EXISTS idx_pod_verified ON proof_of_delivery(verified_at);
      CREATE INDEX IF NOT EXISTS idx_pod_created ON proof_of_delivery(created_at);
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_delivery ON notifications(delivery_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
      CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
      CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_notification_preferences(user_id);
      CREATE INDEX IF NOT EXISTS idx_delivery_logs_user ON notification_delivery_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_delivery_logs_channel ON notification_delivery_logs(channel);
      CREATE INDEX IF NOT EXISTS idx_delivery_logs_status ON notification_delivery_logs(status);
      CREATE INDEX IF NOT EXISTS idx_delivery_logs_created ON notification_delivery_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_phone_tokens_user ON phone_verification_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_phone_tokens_phone ON phone_verification_tokens(phone_number);
      CREATE INDEX IF NOT EXISTS idx_scheduled_deliveries_customer ON scheduled_deliveries(customer_id);
      CREATE INDEX IF NOT EXISTS idx_scheduled_deliveries_driver ON scheduled_deliveries(driver_id);
      CREATE INDEX IF NOT EXISTS idx_scheduled_deliveries_status ON scheduled_deliveries(status);
      CREATE INDEX IF NOT EXISTS idx_scheduled_deliveries_time ON scheduled_deliveries(scheduled_pickup_time, scheduled_delivery_time);
      CREATE INDEX IF NOT EXISTS idx_delivery_preferences_user ON delivery_preferences(user_id);
      CREATE INDEX IF NOT EXISTS idx_delivery_preferences_type ON delivery_preferences(user_type);
      CREATE INDEX IF NOT EXISTS idx_promotion_banners_campaign ON promotion_banners(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_promotion_banners_active ON promotion_banners(is_active);
      CREATE INDEX IF NOT EXISTS idx_promotion_banners_dates ON promotion_banners(start_date, end_date);
      CREATE INDEX IF NOT EXISTS idx_bulk_messages_campaign ON bulk_messages(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_bulk_messages_created_by ON bulk_messages(created_by);
      CREATE INDEX IF NOT EXISTS idx_bulk_messages_status ON bulk_messages(status);
      CREATE INDEX IF NOT EXISTS idx_bulk_messages_created ON bulk_messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_rate_limit_ip ON rate_limit_tracking(ip_address);
      CREATE INDEX IF NOT EXISTS idx_rate_limit_user ON rate_limit_tracking(user_id);
      CREATE INDEX IF NOT EXISTS idx_rate_limit_endpoint ON rate_limit_tracking(endpoint);
      CREATE INDEX IF NOT EXISTS idx_rate_limit_blocked ON rate_limit_tracking(is_blocked);
      CREATE INDEX IF NOT EXISTS idx_rate_limit_created ON rate_limit_tracking(created_at);
      CREATE INDEX IF NOT EXISTS idx_whitelist_ip ON ip_whitelist(ip_address);
      CREATE INDEX IF NOT EXISTS idx_analytics_endpoint ON rate_limit_analytics(endpoint);
      CREATE INDEX IF NOT EXISTS idx_analytics_date ON rate_limit_analytics(date_recorded);
    `);
    console.log('✅ Database indexes created');

  } catch (err) {
    console.error('❌ Error creating tables:', err);
    throw err;
  }
};

// Helper functions for spatial queries
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: result.rowCount });
    return result;
  } catch (err) {
    console.error('Database query error:', err);
    throw err;
  }
};

export {
  pool,
  query,
  testConnection,
  initializeDatabase,
};
