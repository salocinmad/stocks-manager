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
        preferred_currency TEXT DEFAULT 'EUR',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // 1.1 Añadir columnas role e is_blocked si no existen
    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`;
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
        exchange_rate_to_eur DECIMAL DEFAULT 1.0,
        date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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

    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_events_user_date ON financial_events(user_id, event_date)`;
      console.log('Created index: idx_events_user_date');
    } catch (e: any) { console.error('Migration error (idx_events_user_date):', e.message); }

    // --- Default AI Prompts ---
    try {
      const chatPrompt = await sql`SELECT value FROM system_settings WHERE key = 'AI_PROMPT_CHATBOT'`;
      if (chatPrompt.length === 0) {
        const defaultChatPrompt = `Eres "Stocks Bot", un asistente financiero conversacional experto.

HISTORIAL DE CONVERSACIÓN RECIENTE:
{{CHAT_HISTORY}}

DATOS DE MERCADO DISPONIBLES (Contexto):
{{MARKET_DATA}}

Instrucciones:
1. Tu tarea actual es responder al ÚLTIMO mensaje del usuario (en el historial).
2. Usa el historial para entender de qué ticker se está hablando si no se menciona explícitamente en el último mensaje.
3. Si preguntan por soportes/resistencias, usa los datos contextuales proporcionados (Soporte CP / Resistencia CP o Rango Anual).
4. Mantén tus respuestas conversacionales y útiles.`;
        await sql`INSERT INTO system_settings (key, value) VALUES ('AI_PROMPT_CHATBOT', ${defaultChatPrompt})`;
        console.log('Initialized AI_PROMPT_CHATBOT');
      }

      const analysisPrompt = await sql`SELECT value FROM system_settings WHERE key = 'AI_PROMPT_ANALYSIS'`;
      if (analysisPrompt.length === 0) {
        const defaultAnalysisPrompt = `Actúa como "Stocks Bot", un Analista Financiero Senior experto de Wall Street creado para esta plataforma.

CONTEXTO DEL PORTAFOLIO DEL CLIENTE:
{{PORTFOLIO_CONTEXT}}

DATOS DE MERCADO:
{{MARKET_CONTEXT}}

Pregunta del usuario: "{{USER_MESSAGE}}"

INSTRUCCIONES:
- Responde en español, de forma profesional, concisa y basada en los DATOS proporcionados arriba.
- Si ves una "Curva de Precios", analízala brevemente (tendencia alcista/bajista, volatilidad).
- Da consejos estratégicos sobre diversificación y riesgo si aplica.
- Si te preguntan por una acción cuyos datos acabas de recibir (arriba), úsalos para opinar.
- Identifícate siempre como Stocks Bot.`;
        await sql`INSERT INTO system_settings (key, value) VALUES ('AI_PROMPT_ANALYSIS', ${defaultAnalysisPrompt})`;
        console.log('Initialized AI_PROMPT_ANALYSIS');
      }
    } catch (e: any) {
      console.error('Error initializing AI Prompts:', e.message);
    }

  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}
