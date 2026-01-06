import sql from '../db';

/**
 * Migration: Add last_processed_at column to global_tickers
 * This tracks when each ticker was last enriched with Yahoo V10 data
 */
async function migrate() {
    console.log('[Migration] Adding last_processed_at column to global_tickers...');

    try {
        await sql`
            ALTER TABLE global_tickers 
            ADD COLUMN IF NOT EXISTS last_processed_at TIMESTAMP DEFAULT NULL
        `;

        console.log('[Migration] ✅ Column added successfully');
        process.exit(0);
    } catch (error) {
        console.error('[Migration] ❌ Error:', error);
        process.exit(1);
    }
}

migrate();
