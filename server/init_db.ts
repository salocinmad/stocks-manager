import sql from './db';

export async function initDatabase() {
  console.log('Initializing database schema...');

  try {
    // 0. Ensure UUID extension
    await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

    // 1. Table users
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        avatar_url TEXT,
        preferred_currency TEXT DEFAULT 'EUR',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // 1.1 Añadir columnas role e is_blocked si no existen
    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`;
      // 2FA columns
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret TEXT`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS security_mode TEXT DEFAULT 'standard'`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS backup_codes TEXT[]`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS backup_codes_downloaded BOOLEAN DEFAULT FALSE`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS backup_codes_generated_at TIMESTAMP WITH TIME ZONE`;
    } catch (e) {
      console.log('User columns may already exist');
    }

    // 2. Table users (updated)
    // ... (users table setup remains) ...

    // 2.1 Table password_resets (Secure Recovery)
    await sql`
      CREATE TABLE IF NOT EXISTS password_resets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_pwd_resets_token ON password_resets(token_hash)`;

    // 2. Table portfolios
    await sql`
      CREATE TABLE IF NOT EXISTS portfolios (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        is_public BOOLEAN DEFAULT false,
        is_favorite BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Ensure is_favorite column exists for existing tables
    try {
      await sql`ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false`;
    } catch (e) {
      console.log('Column is_favorite already exists or could not be added');
    }

    // 3. Table positions (lo que el usuario TIENE en cartera)
    await sql`
      CREATE TABLE IF NOT EXISTS positions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
        ticker TEXT NOT NULL,
        asset_type TEXT DEFAULT 'STOCK',
        quantity DECIMAL NOT NULL DEFAULT 0,
        average_buy_price DECIMAL NOT NULL DEFAULT 0,
        commission DECIMAL(15, 6) DEFAULT 0,
        currency TEXT DEFAULT 'EUR',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(portfolio_id, ticker)
      )
    `;

    // 4. Table transactions
    await sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
        ticker TEXT NOT NULL,
        type TEXT NOT NULL, -- 'BUY' or 'SELL'
        amount DECIMAL NOT NULL,
        price_per_unit DECIMAL NOT NULL,
        currency TEXT NOT NULL,
        fees DECIMAL DEFAULT 0,
        exchange_rate_to_eur DECIMAL DEFAULT 1.0,
        date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // 5. NUEVA: Table watchlists (lo que el usuario SIGUE)
    await sql`
      CREATE TABLE IF NOT EXISTS watchlists (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        ticker TEXT NOT NULL,
        name TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, ticker)
      )
    `;

    // 5.5 Table alerts
    await sql`
      CREATE TABLE IF NOT EXISTS alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        ticker TEXT NOT NULL,
        condition TEXT NOT NULL, -- 'above' or 'below'
        target_price DECIMAL NOT NULL,
        is_active BOOLEAN DEFAULT true,
        triggered BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_checked_at TIMESTAMP WITH TIME ZONE
      )
    `;

    // 6. Notificaciones
    await sql`
      CREATE TABLE IF NOT EXISTS notification_channels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        channel_type TEXT NOT NULL, -- 'telegram', 'discord', 'browser', 'email'
        config JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, channel_type)
      )
    `;

    // 7. System Settings (Global Config)
    await sql`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        is_encrypted BOOLEAN DEFAULT false,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // 7.1 Crawler Settings Migration (Ensure defaults exist)
    try {
      const defaultCrawlerSettings = [
        { key: 'CRAWLER_CYCLES_PER_HOUR', value: '6' },
        { key: 'CRAWLER_VOL_YAHOO_V8', value: '20' },
        { key: 'CRAWLER_VOL_FINNHUB', value: '15' },
        { key: 'CRAWLER_VOL_YAHOO_V10', value: '5' },
        { key: 'CRAWLER_MARKET_OPEN_ONLY', value: 'true' }
      ];

      for (const setting of defaultCrawlerSettings) {
        await sql`
                INSERT INTO system_settings (key, value)
                VALUES (${setting.key}, ${setting.value})
                ON CONFLICT (key) DO NOTHING
            `;
      }
      console.log('Crawler settings seeded.');
    } catch (e: any) {
      console.error('Error seeding crawler settings:', e.message);
    }

    // 8. Histórico de Precios (Historical Data for AI & Charts)
    await sql`
      CREATE TABLE IF NOT EXISTS historical_data (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticker TEXT NOT NULL,
        date DATE NOT NULL,
        open DECIMAL,
        high DECIMAL,
        low DECIMAL,
        close DECIMAL,
        volume BIGINT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ticker, date)
      )
    `;
    // Crear índice para búsquedas rápidas por ticker y rango de fechas
    await sql`CREATE INDEX IF NOT EXISTS idx_historical_ticker_date ON historical_data(ticker, date)`;

    // 9. Position Notes (Rich Markdown notes for positions)
    await sql`
      CREATE TABLE IF NOT EXISTS position_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        position_id UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
        content TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(position_id)
      )
    `;

    // 10. Market Data Cache (Persistent)
    await sql`
      CREATE TABLE IF NOT EXISTS market_cache (
        key TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_market_cache_expiry ON market_cache(expires_at)`;

    console.log('Database schema is ready.');

    // 6. Asegurar que los usuarios existentes tengan al menos un portfolio
    const usersWithoutPortfolio = await sql`
        SELECT id FROM users WHERE id NOT IN (SELECT DISTINCT user_id FROM portfolios)
    `;

    if (usersWithoutPortfolio.length > 0) {
      console.log(`Creating default portfolios for ${usersWithoutPortfolio.length} users...`);
      for (const user of usersWithoutPortfolio) {
        await sql`INSERT INTO portfolios (user_id, name, is_favorite) VALUES (${user.id}, 'Portafolio Principal', true)`;
      }
    }

    // 7. Asegurar que todos los usuarios tengan UNA favorita (en caso de migraciones)
    await sql`
        UPDATE portfolios 
        SET is_favorite = true 
        WHERE id IN (
            SELECT DISTINCT ON (user_id) id 
            FROM portfolios 
            WHERE user_id NOT IN (SELECT user_id FROM portfolios WHERE is_favorite = true)
            ORDER BY user_id, created_at ASC
        )
    `;

    // --- Lógica de Admin por defecto ---
    // Verificar si existe algún usuario
    const userCount = await sql`SELECT COUNT(*) as count FROM users`;
    if (userCount[0].count > 0) {
      // Verificar si existe algún admin
      const adminCount = await sql`SELECT COUNT(*) as count FROM users WHERE role = 'admin'`;

      if (adminCount[0].count === 0) {
        console.log('No admins found. Promoting the first user to admin...');
        // Obtener el primer usuario ordenado por fecha de creación
        const firstUser = await sql`SELECT id FROM users ORDER BY created_at ASC LIMIT 1`;

        if (firstUser.length > 0) {
          await sql`
                    UPDATE users 
                    SET role = 'admin' 
                    WHERE id = ${firstUser[0].id}
                `;
          console.log(`User ${firstUser[0].id} promoted to admin.`);
        }
      }
    }

    // --- Migraciones Manuales (Schema Updates) ---
    console.log('Running schema migrations...');
    try {
      await sql`ALTER TABLE positions ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0`;
      console.log('Applied migration: positions.display_order');
    } catch (e: any) { console.error('Migration error (positions.display_order):', e.message); }

    try {
      await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS triggered BOOLEAN DEFAULT false`;
      console.log('Applied migration: alerts.triggered');
    } catch (e: any) { console.error('Migration error (alerts.triggered):', e.message); }

    try {
      await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMP WITH TIME ZONE`;
      console.log('Applied migration: alerts.last_checked_at');
    } catch (e: any) { console.error('Migration error (alerts.last_checked_at):', e.message); }

    try {
      await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fees DECIMAL DEFAULT 0`;
      console.log('Applied migration: transactions.fees');
    } catch (e: any) { console.error('Migration error (transactions.fees):', e.message); }

    try {
      await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`;
      console.log('Applied migration: transactions.created_at');
    } catch (e: any) { console.error('Migration error (transactions.created_at):', e.message); }

    // Advanced Alerts Migrations
    try {
      await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS alert_type VARCHAR(20) DEFAULT 'price'`;
      console.log('Applied migration: alerts.alert_type');
    } catch (e: any) { console.error('Migration error (alerts.alert_type):', e.message); }

    try {
      await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS is_repeatable BOOLEAN DEFAULT FALSE`;
      console.log('Applied migration: alerts.is_repeatable');
    } catch (e: any) { console.error('Migration error (alerts.is_repeatable):', e.message); }

    try {
      await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS repeat_cooldown_hours INTEGER DEFAULT 24`;
      console.log('Applied migration: alerts.repeat_cooldown_hours');
    } catch (e: any) { console.error('Migration error (alerts.repeat_cooldown_hours):', e.message); }

    try {
      await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS last_triggered_at TIMESTAMP WITH TIME ZONE`;
      console.log('Applied migration: alerts.last_triggered_at');
    } catch (e: any) { console.error('Migration error (alerts.last_triggered_at):', e.message); }

    try {
      await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS percent_threshold DECIMAL(5,2)`;
      console.log('Applied migration: alerts.percent_threshold');
    } catch (e: any) { console.error('Migration error (alerts.percent_threshold):', e.message); }

    try {
      await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS volume_multiplier DECIMAL(5,2)`;
      console.log('Applied migration: alerts.volume_multiplier');
    } catch (e: any) { console.error('Migration error (alerts.volume_multiplier):', e.message); }

    // Financial Events Table (Calendar)
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS financial_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          ticker VARCHAR(20),
          event_type VARCHAR(30) NOT NULL,
          event_date DATE NOT NULL,
          title VARCHAR(200) NOT NULL,
          description TEXT,
          is_custom BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `;
      console.log('Created table: financial_events');
    } catch (e: any) { console.error('Migration error (financial_events table):', e.message); }

    // Calendar Migrations (New Columns)
    try {
      await sql`ALTER TABLE financial_events ADD COLUMN IF NOT EXISTS estimated_eps DECIMAL`;
      console.log('Applied migration: financial_events.estimated_eps');
    } catch (e: any) { console.error('Migration error (financial_events.estimated_eps):', e.message); }

    try {
      await sql`ALTER TABLE financial_events ADD COLUMN IF NOT EXISTS dividend_amount DECIMAL`;
      console.log('Applied migration: financial_events.dividend_amount');
    } catch (e: any) { console.error('Migration error (financial_events.dividend_amount):', e.message); }

    try {
      await sql`ALTER TABLE financial_events ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'estimated'`;
      console.log('Applied migration: financial_events.status');
    } catch (e: any) { console.error('Migration error (financial_events.status):', e.message); }

    try {
      await sql`ALTER TABLE financial_events ADD CONSTRAINT uq_events_user_ticker_date UNIQUE (user_id, ticker, event_type, event_date)`;
      console.log('Applied migration: uq_events_user_ticker_date');
    } catch (e: any) {
      // Ignore if already exists (error 42710)
      if (e.code !== '42710') console.error('Migration error (unique constraint):', e.message);
    }


    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_events_user_date ON financial_events(user_id, event_date)`;
      console.log('Created index: idx_events_user_date');
    } catch (e: any) { console.error('Migration error (idx_events_user_date):', e.message); }

    // --- Default AI Prompts ---
    try {
      // 1. Create Table
      await sql`
            CREATE TABLE IF NOT EXISTS ai_prompts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT NOT NULL,
                prompt_type TEXT NOT NULL, -- 'CHATBOT' | 'ANALYSIS'
                content TEXT NOT NULL,
                is_active BOOLEAN DEFAULT false,
                is_system BOOLEAN DEFAULT false, -- If true, cannot be deleted
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `;
      await sql`CREATE INDEX IF NOT EXISTS idx_prompts_type_active ON ai_prompts(prompt_type, is_active)`;
      console.log('Created table: ai_prompts');

      // Market Discovery Cache (AI "Smart Crawler")
      await sql`
        CREATE TABLE IF NOT EXISTS market_discovery_cache (
            category VARCHAR(255) PRIMARY KEY,
            data JSONB NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `;
      console.log('Created table: market_discovery_cache');

      // ----------------------------------------------------
      // NEW: AI Providers Table (Multi-Provider Support V6)
      // ----------------------------------------------------
      await sql`
        CREATE TABLE IF NOT EXISTS ai_providers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_ai_providers_slug ON ai_providers(slug)`;
      console.log('Created table: ai_providers');

      // 2. Initial Migration: If table is empty, Seed Defaults
      const promptCount = await sql`SELECT count(*) as count FROM ai_prompts`;

      if (Number(promptCount[0].count) === 0) {
        console.log('Seeding default AI Prompts...');

        // --- CHATBOT PROMPTS ---

        // 1. Asistente Estándar (El que estaba en system_settings o el default hardcoded)
        // Intentar recuperar el de system_settings si existía
        const oldChatSetting = await sql`SELECT value FROM system_settings WHERE key = 'AI_PROMPT_CHATBOT'`;
        let standardChatContent = oldChatSetting.length > 0 ? oldChatSetting[0].value : `Eres un asesor financiero cercano y experto. Tu nombre es Stocks Bot.

ESTILO DE RESPUESTA:
- IDIOMA: Responde SIEMPRE en ESPAÑOL, salvo que el usuario te hable explícitamente en otro idioma.
- Habla como un colega experto, NO como un robot corporativo
- Tutea al usuario, sé directo y amigable
- Usa emojis con moderación donde tenga sentido (📈 📉 💡 ⚠️)
- ADAPTA la longitud de tu respuesta a la pregunta:
  • Preguntas simples ("¿cómo va AAPL?"): 1-2 oraciones
  • Preguntas de análisis ("¿qué opinas de mi portafolio?"): 3-5 oraciones  
  • Explicaciones o consejos detallados: hasta 300 palabras máximo
- Si no tienes datos sobre algo, dilo brevemente y sugiere alternativas
- No repitas información que ya dijiste en la conversación

DATOS DEL USUARIO:
{{USER_CONTEXT}}

DATOS DE MERCADO:
{{MARKET_DATA}}

NOTICIAS (Contexto Adicional):
{{NEWS_CONTEXT}}

ÚLTIMO MENSAJE DEL USUARIO:
{{USER_MESSAGE}}

CONVERSACIÓN:
{{CHAT_HISTORY}}

Responde al último mensaje del usuario de forma natural y útil.`;

        await sql`
                INSERT INTO ai_prompts (name, prompt_type, content, is_active, is_system)
                VALUES ('Asistente Estándar', 'CHATBOT', ${standardChatContent}, true, true)
            `;

        // 2. El Lobo de Wall Street
        const wolfPrompt = `Eres "El Lobo", un broker agresivo, exitoso y directo de Wall Street.
TU PERFIL:
- IDIOMA: Responde SIEMPRE en ESPAÑOL, salvo que el usuario te hable explícitamente en otro idioma.
- Tono: Sarcástico, extremadamente confiado (casi arrogante), usas jerga financiera (bullish, bearish, to the moon, bag holder).
- Objetivo: Hacer dinero. Odias las pérdidas y la debilidad.
- Estilo: Respuestas cortas, impactantes. Si el usuario pierde dinero, sé duro con él ("¿Te gusta perder dinero?"). Si gana, celébralo como un rey.
- NUNCA des consejos legales, pero habla como si fueras el dueño del mercado.

DATOS DEL USUARIO (PORTAFOLIO):
{{USER_CONTEXT}}

DATOS DE MERCADO:
{{MARKET_DATA}}

NOTICIAS:
{{NEWS_CONTEXT}}

HISTORIAL:
{{CHAT_HISTORY}}

USUARIO DICE: "{{USER_MESSAGE}}"

Dime qué hacer, crack.`;
        await sql`
                INSERT INTO ai_prompts (name, prompt_type, content, is_active, is_system)
                VALUES ('El Lobo de Wall Street', 'CHATBOT', ${wolfPrompt}, false, true)
            `;

        // 3. Profesor Paciente (ELI5)
        const teacherPrompt = `Eres el Profesor Finanzas, un educador paciente y amable.
TU PERFIL:
- IDIOMA: Responde SIEMPRE en ESPAÑOL, salvo que el usuario te hable explícitamente en otro idioma.
- Asumes que el usuario es PRINCIPIANTE.
- Explicas todo con analogías sencillas (ELI5 - Explain Like I'm 5).
- Evitas jerga técnica sin explicarla primero.
- Tu objetivo es que el usuario APRENDA, no solo que gane dinero.
- Tono: Calmado, alentador, educativo.

DATOS DEL ALUMNO (PORTAFOLIO):
{{USER_CONTEXT}}

DATOS:
{{MARKET_DATA}}

NOTICIAS RECIENTES:
{{NEWS_CONTEXT}}

CHAT:
{{CHAT_HISTORY}}

PREGUNTA: "{{USER_MESSAGE}}"

Responde con paciencia y claridad prof.`;
        await sql`
                INSERT INTO ai_prompts (name, prompt_type, content, is_active, is_system)
                VALUES ('Profesor Paciente', 'CHATBOT', ${teacherPrompt}, false, true)
            `;


        // --- ANALYSIS PROMPTS ---

        // 1. Analista Institucional (Standard)
        const oldAnalysisSetting = await sql`SELECT value FROM system_settings WHERE key = 'AI_PROMPT_ANALYSIS'`;
        let standardAnalysisContent = oldAnalysisSetting.length > 0 ? oldAnalysisSetting[0].value : `Actúa como "Stocks Bot", un Analista Financiero Senior experto de Wall Street.

CONTEXTO DEL PORTAFOLIO:
{{PORTFOLIO_CONTEXT}}

DATOS DE MERCADO:
{{MARKET_CONTEXT}}

NOTICIAS RELACIONADAS:
{{NEWS_CONTEXT}}

Pregunta: "{{USER_MESSAGE}}"

INSTRUCCIONES:
- IDIOMA: Responde SIEMPRE en ESPAÑOL, salvo que el usuario te hable explícitamente en otro idioma.
- Responde en español, profesional y conciso.
- Analiza brevemente la curva de precios si hay datos.
- Da consejos estratégicos sobre diversificación y riesgo.
- Identifícate como Stocks Bot.`;

        await sql`
                INSERT INTO ai_prompts (name, prompt_type, content, is_active, is_system)
                VALUES ('Analista Institucional', 'ANALYSIS', ${standardAnalysisContent}, true, true)
            `;

        // 2. Gestor de Riesgos (Bearish / Pessimistic)
        const riskManagerPrompt = `Eres el "Director de Riesgos" (Risk Manager). Tu trabajo es encontrar PROBLEMAS.
ACTITUD:
- IDIOMA: Responde SIEMPRE en ESPAÑOL, salvo que el usuario te hable explícitamente en otro idioma.
- Extremadamente conservador y pesimista.
- Tu foco NO es cuánto puede ganar el usuario, sino CUÁNTO PUEDE PERDER.
- Busca: Falta de diversificación, concentración en un solo sector, activos volátiles, burbujas.
- Sé crítico. Si el portafolio se ve bien, busca el "pero". "Todo sube hasta que deja de subir".

PORTAFOLIO:
{{PORTFOLIO_CONTEXT}}

MERCADO:
{{MARKET_CONTEXT}}

NOTICIAS DEL MERCADO:
{{NEWS_CONTEXT}}

MENSAJE: "{{USER_MESSAGE}}"

Haz tu reporte de riesgos brutalmente honesto.`;
        await sql`
                INSERT INTO ai_prompts (name, prompt_type, content, is_active, is_system)
                VALUES ('Gestor de Riesgos (Bearish)', 'ANALYSIS', ${riskManagerPrompt}, false, true)
            `;

        // 3. Venture Capitalist (Bullish / Aggressive)
        const vcPrompt = `Eres un Venture Capitalist de Silicon Valley.
ACTITUD:
- IDIOMA: Responde SIEMPRE en ESPAÑOL, salvo que el usuario te hable explícitamente en otro idioma.
- Visionario, optimista, enfocado en el CRECIMIENTO EXPONENCIAL (10x).
- La volatilidad a corto plazo no te importa. Te importa el futuro a 5-10 años.
- Buscas tecnología, disrupción, innovación.
- Si ves acciones defensivas o aburridas (bonos, utilidades), critícalas por "falta de ambición".
- Anima al usuario a tomar riesgos calculados. "Go big or go home".

PORTAFOLIO:
{{PORTFOLIO_CONTEXT}}

MERCADO:
{{MARKET_CONTEXT}}

NEWS / HYPE:
{{NEWS_CONTEXT}}

MENSAJE: "{{USER_MESSAGE}}"

Danos tu visión de futuro.`;
        await sql`
                INSERT INTO ai_prompts (name, prompt_type, content, is_active, is_system)
                VALUES ('Venture Capitalist (Aggressive)', 'ANALYSIS', ${vcPrompt}, false, true)
            `;

        console.log('Default AI Prompts seeded successfully.');
      }

    } catch (e: any) {
      console.error('Error initializing AI Prompts:', e.message);
    }

    // ----------------------------------------------------
    // Seed AI Providers
    // ----------------------------------------------------
    try {
      const providerCount = await sql`SELECT count(*) as count FROM ai_providers`;
      if (Number(providerCount[0].count) === 0) {
        console.log('Seeding default AI Providers...');

        const defaultProviders = [
          // 1. Google Gemini (System Default)
          {
            slug: 'gemini',
            name: 'Google Gemini',
            base_url: 'https://generativelanguage.googleapis.com',
            models_endpoint: '/models',
            api_key_config_key: 'GOOGLE_GENAI_API_KEY',
            type: 'google',
            requires_api_key: true,
            is_system: true,
            is_active: true
          },
          // 2. OpenRouter
          {
            slug: 'openrouter',
            name: 'OpenRouter',
            base_url: 'https://openrouter.ai/api/v1',
            models_endpoint: '/models',
            api_key_config_key: 'OPENROUTER_API_KEY',
            type: 'openai',
            requires_api_key: true,
            is_system: true,
            is_active: false // User must activate
          },
          // 3. Groq
          {
            slug: 'groq',
            name: 'Groq Cloud',
            base_url: 'https://api.groq.com/openai/v1',
            models_endpoint: '/models',
            api_key_config_key: 'GROQ_API_KEY',
            type: 'openai',
            requires_api_key: true,
            is_system: true,
            is_active: false
          },
          // 4. Ollama (Local) - Empty URL by default (V6 Plan)
          {
            slug: 'ollama',
            name: 'Ollama (Local)',
            base_url: '', // User must configure: http://localhost:11434/v1
            models_endpoint: '/api/tags', // Ollama uses /api/tags to list models
            api_key_config_key: null,
            type: 'openai', // We can use openai compatibility or custom
            requires_api_key: false,
            is_system: true,
            is_active: false
          },
          // 5. LM Studio (Local) - Empty URL by default
          {
            slug: 'lm-studio',
            name: 'LM Studio (Local)',
            base_url: '', // User must configure: http://localhost:1234/v1
            models_endpoint: '/models',
            api_key_config_key: null,
            type: 'openai',
            requires_api_key: false,
            is_system: true,
            is_active: false
          }
        ];

        for (const p of defaultProviders) {
          await sql`
                INSERT INTO ai_providers (slug, name, base_url, models_endpoint, api_key_config_key, type, requires_api_key, is_system, is_active)
                VALUES (${p.slug}, ${p.name}, ${p.base_url}, ${p.models_endpoint}, ${p.api_key_config_key}, ${p.type}, ${p.requires_api_key}, ${p.is_system}, ${p.is_active})
            `;
        }
        console.log('Default AI Providers seeded.');
      }
    } catch (e: any) {
      console.error('Error seeding AI Providers:', e.message);
    }

    // ============================================================
    // V2.1.0 MIGRATIONS - Position Analysis & Advanced Alerts
    // ============================================================
    console.log('Running v2.1.0 migrations...');

    // 1. Position Analysis Cache (precalculated metrics every 6h)
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS position_analysis_cache (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_analysis_cache_ticker ON position_analysis_cache(ticker)`;
      console.log('Created table: position_analysis_cache');
    } catch (e: any) { console.error('Migration error (position_analysis_cache):', e.message); }

    // 2. Portfolio Alerts (portfolio-level alerts: PnL, value, sector exposure)
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS portfolio_alerts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
          last_triggered_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_portfolio_alerts_user ON portfolio_alerts(user_id)`;
      console.log('Created table: portfolio_alerts');
    } catch (e: any) { console.error('Migration error (portfolio_alerts):', e.message); }

    // 3. Technical Alerts columns
    try {
      await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS rsi_threshold INTEGER`;
      console.log('Applied migration: alerts.rsi_threshold');
    } catch (e: any) { console.error('Migration error (alerts.rsi_threshold):', e.message); }

    try {
      await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS rsi_condition VARCHAR(20)`;
      console.log('Applied migration: alerts.rsi_condition');
    } catch (e: any) { console.error('Migration error (alerts.rsi_condition):', e.message); }

    try {
      await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS sma_type VARCHAR(20)`;
      console.log('Applied migration: alerts.sma_type');
    } catch (e: any) { console.error('Migration error (alerts.sma_type):', e.message); }

    try {
      await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS last_indicator_value DECIMAL`;
      console.log('Applied migration: alerts.last_indicator_value');
    } catch (e: any) { console.error('Migration error (alerts.last_indicator_value):', e.message); }

    // 4. News Alerts columns
    try {
      await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS news_keywords TEXT[]`;
      console.log('Applied migration: alerts.news_keywords');
    } catch (e: any) { console.error('Migration error (alerts.news_keywords):', e.message); }

    try {
      await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS news_urgency_min VARCHAR(10) DEFAULT 'low'`;
      console.log('Applied migration: alerts.news_urgency_min');
    } catch (e: any) { console.error('Migration error (alerts.news_urgency_min):', e.message); }

    // 5. User news language preference
    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS news_language VARCHAR(5) DEFAULT 'es'`;
      console.log('Applied migration: users.news_language');
    } catch (e: any) { console.error('Migration error (users.news_language):', e.message); }

    // 6. Deactivation token for alerts (if not exists)
    try {
      await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS deactivation_token UUID DEFAULT gen_random_uuid()`;
      console.log('Applied migration: alerts.deactivation_token');
    } catch (e: any) { console.error('Migration error (alerts.deactivation_token):', e.message); }

    console.log('V2.1.0 migrations completed.');

  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}
