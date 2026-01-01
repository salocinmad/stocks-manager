
import { PnLService } from '../services/pnlService';
import sql from '../db';

const run = async () => {
    console.log('--- TESTING PnL SERVICE LOGIC (ALL PORTFOLIOS) ---');

    const portfolios = await sql`SELECT * FROM portfolios`;
    console.log(`Found ${portfolios.length} portfolios.`);

    for (const p of portfolios) {
        console.log(`\nChecking Portfolio: ${p.name} (ID: ${p.id}) Fav:${p.is_favorite}`);
        try {
            const fullReport = await PnLService.calculateRealizedPnL_FIFO(p.id);
            console.log(`   -> Full Report Ops: ${fullReport.length}`);

            const filtered = fullReport.filter(op => new Date(op.sellDate).getFullYear() === 2025);
            console.log(`   -> 2025 Ops: ${filtered.length}`);
        } catch (e: any) {
            console.log(`   -> Error: ${e.message}`);
        }
    }
};

run();
