
import sql from '../db';

async function check() {
    console.log('--- Discovery Cache Check ---');
    try {
        const rows = await sql`SELECT category, jsonb_array_length(data) as count, updated_at FROM market_discovery_cache`;
        console.log(`Total Rows: ${rows.length}`);
        rows.forEach(r => {
            console.log(`- ${r.category}: ${r.count} items (Updated: ${r.updated_at})`);
        });

        const stats = await sql`
            SELECT 
                COUNT(*) as total_sectors,
                SUM(jsonb_array_length(data)) as total_companies
            FROM market_discovery_cache
        `;
        console.log('--- Stats ---');
        console.log(stats[0]);

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

check();
