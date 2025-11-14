/**
 * Wallet Schema for In-App Payment System
 */

export const walletSchemaSQL = `
-- User Wallet table
CREATE TABLE IF NOT EXISTS user_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance DECIMAL(15, 2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED')),
  total_loaded DECIMAL(15, 2) DEFAULT 0.00,
  total_spent DECIMAL(15, 2) DEFAULT 0.00,
  last_transaction_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wallet Transactions table (detailed audit trail)
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES user_wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('RELOAD', 'PAYMENT', 'REFUND', 'ADJUSTMENT', 'BONUS')),
  amount DECIMAL(15, 2) NOT NULL,
  description VARCHAR(500),
  balance_before DECIMAL(15, 2),
  balance_after DECIMAL(15, 2),
  reference_id VARCHAR(100),
  delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
  payment_method_id UUID REFERENCES wallet_payment_methods(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED')),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wallet Top-Up Packages (reload options)
CREATE TABLE IF NOT EXISTS wallet_top_up_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  amount DECIMAL(15, 2) NOT NULL,
  bonus_amount DECIMAL(15, 2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'USD',
  description VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wallet Payment Methods (stored payment options)
CREATE TABLE IF NOT EXISTS wallet_payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method_type VARCHAR(50) NOT NULL CHECK (method_type IN ('CARD', 'BANK', 'PAYPAL', 'APPLE_PAY', 'GOOGLE_PAY')),
  name VARCHAR(255),
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  -- Encrypted payment info
  encrypted_token VARCHAR(500),
  last_four VARCHAR(4),
  expiry_month INTEGER,
  expiry_year INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wallet Balance History (for analytics)
CREATE TABLE IF NOT EXISTS wallet_balance_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES user_wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance DECIMAL(15, 2),
  transaction_count INTEGER,
  date_recorded DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wallet Referral/Promo Bonuses
CREATE TABLE IF NOT EXISTS wallet_bonuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bonus_type VARCHAR(50) NOT NULL CHECK (bonus_type IN ('WELCOME', 'REFERRAL', 'PROMO', 'CASHBACK', 'LOYALTY')),
  amount DECIMAL(15, 2) NOT NULL,
  description VARCHAR(500),
  code VARCHAR(50),
  is_claimed BOOLEAN DEFAULT false,
  claimed_at TIMESTAMP,
  expires_at TIMESTAMP,
  campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for wallet tables
CREATE INDEX IF NOT EXISTS idx_wallets_user ON user_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_status ON user_wallets(status);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON wallet_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_delivery ON wallet_transactions(delivery_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON wallet_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_top_up_packages_active ON wallet_top_up_packages(is_active);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON wallet_payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON wallet_payment_methods(is_active);
CREATE INDEX IF NOT EXISTS idx_balance_snapshots_user ON wallet_balance_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_balance_snapshots_date ON wallet_balance_snapshots(date_recorded);
CREATE INDEX IF NOT EXISTS idx_bonuses_user ON wallet_bonuses(user_id);
CREATE INDEX IF NOT EXISTS idx_bonuses_claimed ON wallet_bonuses(is_claimed);
`;
