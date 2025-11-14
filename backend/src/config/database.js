import pkg from 'pg';
const { Client, Pool } = pkg;
import dotenv from 'dotenv';

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
