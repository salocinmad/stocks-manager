
import sql from '../db';

const run = async () => {
    try {
        console.log('--- FIX: ADD created_at ---');
        try {
            await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`;
            console.log('✅ Success: created_at column added.');
        } catch (e: any) {
            console.error('❌ Error adding created_at:', e.message);
        }
    } catch (e) {
        console.error('Script error:', e);
    }
    process.exit(0);
};

run();
