
import sql from '../db';

const run = async () => {
    try {
        console.log('--- SCHEMA INSPECTION ---');

        // 1. Check Transactions Columns
        console.log('Checking transactions table columns...');
        const columns = await sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'transactions'
        `;

        columns.forEach(c => {
            console.log(` - ${c.column_name} (${c.data_type})`);
        });

        // 2. Check Portfolios
        console.log('\nChecking portfolios...');
        const ps = await sql`SELECT id, name FROM portfolios`;
        ps.forEach(p => console.log(`Portfolio: ${p.name} ID:${p.id}`));

    } catch (e) {
        console.error('Schema check error:', e);
    }
};

run();
