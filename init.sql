-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    is_blocked BOOLEAN DEFAULT FALSE,
    preferred_currency VARCHAR(3) DEFAULT 'EUR',
    avatar_url TEXT,
    -- 2FA Fields
    two_factor_secret VARCHAR(64),
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    security_mode VARCHAR(20) DEFAULT 'standard' CHECK (security_mode IN ('standard', 'enhanced')),
    backup_codes TEXT[],
    backup_codes_downloaded BOOLEAN DEFAULT FALSE,
    backup_codes_generated_at TIMESTAMP WITH TIME ZONE,
    news_language VARCHAR(5) DEFAULT 'es',
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. PASSWORD RESETS
CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pwd_resets_token ON password_resets(token_hash);

-- 3. PORTFOLIOS TABLE
CREATE TABLE IF NOT EXISTS portfolios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. POSITIONS TABLE
CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL, -- e.g. AAPL, BTC-USD
    asset_type VARCHAR(20) NOT NULL DEFAULT 'STOCK', -- STOCK, CRYPTO, ETF
    quantity DECIMAL(20, 8) NOT NULL DEFAULT 0,
    average_buy_price DECIMAL(20, 8) NOT NULL DEFAULT 0, -- In original currency
    commission DECIMAL(15, 6) DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR', -- USD, EUR
    current_stop_loss DECIMAL(20, 8),
    current_take_profit DECIMAL(20, 8),
    notes TEXT,
    display_order INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(portfolio_id, ticker)
);

-- 5. TRANSACTIONS TABLE
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
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. WATCHLISTS TABLE
CREATE TABLE IF NOT EXISTS watchlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, ticker)
);

-- 7. ALERTS TABLE
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL,
    condition VARCHAR(10),  -- 'above', 'below'
    target_price DECIMAL(20, 8),
    alert_type VARCHAR(20) DEFAULT 'price', -- 'price', 'percent', 'volume', 'rsi', 'sma', 'news'
    percent_threshold DECIMAL(5,2),
    volume_multiplier DECIMAL(5,2),
    -- Technical alerts (V2.1.0)
    rsi_threshold INTEGER,
    rsi_condition VARCHAR(20),  -- 'above', 'below'
    sma_type VARCHAR(20),       -- 'sma50', 'sma200'
    last_indicator_value DECIMAL,
    -- News alerts
    news_keywords TEXT[],
    news_urgency_min VARCHAR(10) DEFAULT 'low',
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_repeatable BOOLEAN DEFAULT FALSE,
    repeat_cooldown_hours INTEGER DEFAULT 24,
    triggered BOOLEAN DEFAULT FALSE,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    last_checked_at TIMESTAMP WITH TIME ZONE,
    deactivation_token UUID DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. NOTIFICATION CHANNELS
CREATE TABLE IF NOT EXISTS notification_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    channel_type TEXT NOT NULL, -- 'telegram', 'discord', 'browser', 'email'
    config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, channel_type)
);

-- 9. SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    is_encrypted BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_settings (key, value) VALUES 
('APP_VERSION', 'V2.1.0'),
('GLOBAL_TICKER_EXCHANGES', 'MC,PA,LSE,XETRA,T,HK,TO,NSE,AU,SG,AS,MI,SW,ST,OS,CO,HE,BR,LI,VI')
ON CONFLICT (key) DO NOTHING;

-- 10. HISTORICAL DATA
CREATE TABLE IF NOT EXISTS historical_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticker TEXT NOT NULL,
    date DATE NOT NULL,
    open DECIMAL,
    high DECIMAL,
    low DECIMAL,
    close DECIMAL,
    volume BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ticker, date)
);
CREATE INDEX IF NOT EXISTS idx_historical_ticker_date ON historical_data(ticker, date);

-- 11. POSITION NOTES (Markdown)
CREATE TABLE IF NOT EXISTS position_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    position_id UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
    content TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(position_id)
);

-- 12. MARKET CACHE
CREATE TABLE IF NOT EXISTS market_cache (
    key TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_market_cache_expiry ON market_cache(expires_at);

-- 13. FINANCIAL EVENTS
CREATE TABLE IF NOT EXISTS financial_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ticker VARCHAR(20),
    event_type VARCHAR(30) NOT NULL,
    event_date DATE NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    is_custom BOOLEAN DEFAULT FALSE,
    estimated_eps DECIMAL,
    dividend_amount DECIMAL,
    status VARCHAR(20) DEFAULT 'estimated',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, ticker, event_type, event_date)
);
CREATE INDEX IF NOT EXISTS idx_events_user_date ON financial_events(user_id, event_date);

-- 14. AI PROMPTS
CREATE TABLE IF NOT EXISTS ai_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    prompt_type TEXT NOT NULL, -- 'CHATBOT' | 'ANALYSIS'
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT false,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_prompts_type_active ON ai_prompts(prompt_type, is_active);

-- 15. AI PROVIDERS
CREATE TABLE IF NOT EXISTS ai_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL,          -- 'gemini', 'ollama', 'custom-xyz'
    name TEXT NOT NULL,                 -- 'Google Gemini', 'Ollama Local'
    base_url TEXT DEFAULT '',           -- 'https://api.openai.com/v1' OR '' (for locals)
    models_endpoint TEXT DEFAULT '',    -- '/models'
    api_key_config_key TEXT,            -- 'GOOGLE_GENAI_API_KEY', 'OPENROUTER_API_KEY', etc.
    type TEXT DEFAULT 'openai',         -- 'google', 'openai'
    requires_api_key BOOLEAN DEFAULT true, 
    is_system BOOLEAN DEFAULT false,    -- true = cannot delete
    is_active BOOLEAN DEFAULT false,     -- active in selector
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_providers_slug ON ai_providers(slug);

-- 16. CHAT CONVERSATIONS
CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'Nueva conversación',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user ON chat_conversations(user_id);

-- 17. CHAT MESSAGES
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'model')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id);

-- 18. PNL HISTORY CACHE
CREATE TABLE IF NOT EXISTS pnl_history_cache (
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    pnl_eur NUMERIC(20, 4),
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(portfolio_id, date)
);
CREATE INDEX IF NOT EXISTS idx_pnl_cache_portfolio ON pnl_history_cache(portfolio_id);

-- 19. MARKET DISCOVERY CACHE (AI Discovery Engine)
CREATE TABLE IF NOT EXISTS market_discovery_cache (
    category VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 19.5 TICKER DETAILS CACHE (Deep data for Discovery modals)
CREATE TABLE IF NOT EXISTS ticker_details_cache (
    ticker TEXT PRIMARY KEY,
    data JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 20. GLOBAL TICKERS MASTER (Librería Global - V4.0)
CREATE TABLE IF NOT EXISTS global_tickers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL,
    name TEXT NOT NULL,
    isin VARCHAR(20),
    exchange VARCHAR(20) NOT NULL,
    country VARCHAR(100),
    currency VARCHAR(10),
    type VARCHAR(50),
    last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_processed_at TIMESTAMP WITH TIME ZONE,
    yahoo_status VARCHAR(20),  -- NULL=unknown, 'ok'=works, 'failed'=skip
    yahoo_error TEXT,
    UNIQUE(symbol, exchange)
);
CREATE INDEX IF NOT EXISTS idx_global_tickers_isin ON global_tickers(isin);
CREATE INDEX IF NOT EXISTS idx_global_tickers_exchange ON global_tickers(exchange);
CREATE INDEX IF NOT EXISTS idx_global_tickers_yahoo_status ON global_tickers(yahoo_status);

-- 21. POSITION ANALYSIS CACHE (V2.1.0)
CREATE TABLE IF NOT EXISTS position_analysis_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    position_id UUID REFERENCES positions(id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL,
    
    -- Technical Indicators
    rsi DECIMAL,
    sma_50 DECIMAL,
    sma_200 DECIMAL,
    trend VARCHAR(30),
    
    -- Risk Metrics
    volatility DECIMAL,
    sharpe_ratio DECIMAL,
    sortino_ratio DECIMAL,
    max_drawdown DECIMAL,
    beta DECIMAL,
    var_95 DECIMAL,
    risk_score INTEGER,
    
    -- Timestamps
    calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(position_id)
);
CREATE INDEX IF NOT EXISTS idx_analysis_cache_ticker ON position_analysis_cache(ticker);

-- 22. PORTFOLIO ALERTS (V2.1.0)
CREATE TABLE IF NOT EXISTS portfolio_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
    alert_type VARCHAR(30) NOT NULL,
    threshold_value DECIMAL,
    threshold_percent DECIMAL,
    sector_target VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    triggered BOOLEAN DEFAULT false,
    is_repeatable BOOLEAN DEFAULT false,
    repeat_cooldown_hours INTEGER DEFAULT 24,
    triggered_assets JSONB DEFAULT '{}'::jsonb,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_portfolio_alerts_user ON portfolio_alerts(user_id);
