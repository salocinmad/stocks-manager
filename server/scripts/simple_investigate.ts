
import sql from '../db';
import { PnLService } from '../services/pnlService';

const run = async () => {
    try {
        console.log('--- SIMPLE INVESTIGATION ---');

        // 1. Get ALL Portfolios
        const portfolios = await sql`SELECT * FROM portfolios`;
        for (const p of portfolios) {
            console.log(`\nPortfolio: ${p.name} (${p.id})`);

            // 2. Transactions
            const txs = await sql`SELECT * FROM transactions WHERE portfolio_id = ${p.id} ORDER BY date ASC`;
            console.log(`Transactions: ${txs.length}`);

            // 2.5 Positions (Dashboard Source)
            const pos = await sql`SELECT * FROM positions WHERE portfolio_id = ${p.id}`;
            console.log(`Positions: ${pos.length}`);

            let sales2025 = 0;
            txs.forEach(t => {
                const d = new Date(t.date);
                if (t.type === 'SELL' && d.getFullYear() === 2025) sales2025++;
            });
            console.log(`Sales in 2025: ${sales2025}`);

            // 3. FIFO
            try {
                const fifo = await PnLService.calculateRealizedPnL_FIFO(p.id);
                console.log(`FIFO Results: ${fifo.length} ops.`);
                const fifo2025 = fifo.filter(op => new Date(op.sellDate).getFullYear() === 2025);
                console.log(`FIFO 2025 Ops: ${fifo2025.length}`);
            } catch (e: any) {
                console.error('FIFO Error:', e.message);
            }
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
};

run();
