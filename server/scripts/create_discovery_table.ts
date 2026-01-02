
import sql from '../db';

async function main() {
    console.log('--- Migrating: Creating market_discovery_cache table ---');
    try {
        await sql`
            CREATE TABLE IF NOT EXISTS market_discovery_cache (
                category VARCHAR(255) PRIMARY KEY,
                data JSONB NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `;
        console.log('✅ Table market_discovery_cache created (or already exists).');
    } catch (error: any) {
        console.error('❌ Error creating table:', error);
    } finally {
        process.exit(0);
    }
}

main();
