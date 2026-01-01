
import sql from '../db';

const run = async () => {
    try {
        console.log('--- MANUAL SCHEMA FIX ---');

        console.log('Adding column "fees" to transactions...');
        try {
            await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fees DECIMAL DEFAULT 0`;
            console.log('✅ Success: fees column added/exists.');
        } catch (e: any) {
            console.error('❌ Error adding fees:', e.message);
        }

        console.log('Adding column "exchange_rate_to_eur" to transactions...');
        try {
            // Check if it exists first just in case
            await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS exchange_rate_to_eur DECIMAL DEFAULT 1.0`;
            console.log('✅ Success: exchange_rate_to_eur column added/exists.');
        } catch (e: any) {
            console.error('❌ Error adding exchange_rate_to_eur:', e.message);
        }

    } catch (e) {
        console.error('Script error:', e);
    }
    process.exit(0);
};

run();
