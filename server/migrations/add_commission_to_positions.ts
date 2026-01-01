
import sql from '../db';

async function migrate() {
    try {
        console.log('Adding commission column to positions table...');
        await sql`
            ALTER TABLE positions 
            ADD COLUMN IF NOT EXISTS commission DECIMAL(15, 6) DEFAULT 0;
        `;
        console.log('Migration successful: commission column added.');
    } catch (error) {
        console.error('Migration failed:', error);
    }
    process.exit(0);
}

migrate();
