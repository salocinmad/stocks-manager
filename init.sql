-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    is_blocked BOOLEAN DEFAULT FALSE,
    preferred_currency VARCHAR(3) DEFAULT 'EUR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- PORTFOLIOS TABLE
CREATE TABLE IF NOT EXISTS portfolios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ASSETS (Watchlist/Global or Per Portfolio? Typically global definition is better, but for simplicity we can store holdings directly or have a definition table)
-- Let's have a simplified Holdings approach first, effectively 'Positions'

CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL, -- e.g. AAPL, BTC-USD
    asset_type VARCHAR(20) NOT NULL, -- STOCK, CRYPTO, ETF
    quantity DECIMAL(20, 8) NOT NULL DEFAULT 0,
    average_buy_price DECIMAL(20, 8) NOT NULL DEFAULT 0, -- In original currency
    currency VARCHAR(3) NOT NULL, -- USD, EUR
    current_stop_loss DECIMAL(20, 8),
    current_take_profit DECIMAL(20, 8),
    notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- TRANSACTIONS (History)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('BUY', 'SELL', 'DIVIDEND', 'DEPOSIT', 'WITHDRAWAL')),
    amount DECIMAL(20, 8) NOT NULL,
    price_per_unit DECIMAL(20, 8) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    exchange_rate_to_eur DECIMAL(20, 8) DEFAULT 1.0, -- FX Rate at moment of transaction
    fees DECIMAL(20, 8) DEFAULT 0,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ALERTS
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL,
    target_price DECIMAL(20, 8) NOT NULL,
    condition VARCHAR(10) CHECK (condition IN ('ABOVE', 'BELOW')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- CHAT HISTORY (Optional for context)
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- PNL HISTORY CACHE (For fast dashboard loading)
CREATE TABLE IF NOT EXISTS pnl_history_cache (
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    pnl_eur NUMERIC(20, 4),
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(portfolio_id, date)
);

CREATE INDEX IF NOT EXISTS idx_pnl_cache_portfolio ON pnl_history_cache(portfolio_id);
