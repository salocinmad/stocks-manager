import sql from '../db';

async function createTable() {
    console.log('🛠 Creating ticker_details_cache table...');
    try {
        await sql`
            CREATE TABLE IF NOT EXISTS ticker_details_cache (
                ticker TEXT PRIMARY KEY,
                data JSONB,
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `;
        console.log('✅ Table created successfully');
    } catch (error) {
        console.error('❌ Error creating table:', error);
    } finally {
        process.exit(0);
    }
}

createTable();
