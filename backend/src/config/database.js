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
        customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
