
import sql from '../db';

async function checkSchema() {
    try {
        const columns = await sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'positions';
        `;
        console.log('Columns in positions table:', columns);
    } catch (error) {
        console.error('Error:', error);
    }
    process.exit(0);
}

checkSchema();
