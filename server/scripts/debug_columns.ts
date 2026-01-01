
import sql from '../db';

const run = async () => {
    try {
        console.log('--- DEBUG COLUMNS ---');

        console.log('Attemping SELECT fees...');
        try {
            const r = await sql`SELECT fees FROM transactions LIMIT 1`;
            console.log('✅ SELECT fees success. Rows:', r.length);
        } catch (e: any) {
            console.error('❌ SELECT fees FAILED:', e.message);
        }

        console.log('Attemping SELECT exchange_rate_to_eur...');
        try {
            const r = await sql`SELECT exchange_rate_to_eur FROM transactions LIMIT 1`;
            console.log('✅ SELECT exchange_rate_to_eur success. Rows:', r.length);
        } catch (e: any) {
            console.error('❌ SELECT exchange_rate_to_eur FAILED:', e.message);
        }

    } catch (e) {
        console.error('Script error:', e);
    }
    process.exit(0);
};

run();
