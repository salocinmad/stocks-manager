import sql from '../db';
import { PnLService } from '../services/pnlService';
import { MarketDataService } from '../services/marketData';

const logBuffer: string[] = [];
const log = (...args: any[]) => {
    const msg = args.join(' ');
    console.log(msg);
    logBuffer.push(msg);
};

const run = async () => {
    try {
        log('--- CORRECTED INVESTIGATION ---');

        // 1. Get Portfolio with most positions
        const portfolios = await sql`
            SELECT p.*, count(pos.id) as pos_count 
            FROM portfolios p
            LEFT JOIN positions pos ON p.id = pos.portfolio_id
            GROUP BY p.id
            ORDER BY pos_count DESC
            LIMIT 1
        `;

        if (portfolios.length === 0) {
            log('No portfolios found.');
            await Bun.write('server/debug_result.txt', logBuffer.join('\n'));
            return;
        }
        const p = portfolios[0];
        log(`Targeting Portfolio: ${p.name} (ID: ${p.id})`);
        log(`Positions Count: ${p.pos_count}`);

        // 2. Check 2025 Sales (Fiscal Report Source)
        const txs = await sql`SELECT * FROM transactions WHERE portfolio_id = ${p.id} ORDER BY date ASC`;
        let sales2025 = 0;
        txs.forEach(t => {
            const d = new Date(t.date);
            if (t.type === 'SELL' && d.getFullYear() === 2025) {
                sales2025++;
                log(`[SELL 2025] ${t.ticker} Qty:${t.amount} Price:${t.price_per_unit}`);
            }
        });
        log(`Total Sales in 2025: ${sales2025}`);

        if (sales2025 === 0) {
            log('WARN: No sales in 2025 found in transactions table. Report will be empty.');
        } else {
            log('Checking FIFO calculation...');
            try {
                const fifo = await PnLService.calculateRealizedPnL_FIFO(p.id);
                const fifo2025 = fifo.filter(op => new Date(op.sellDate).getFullYear() === 2025);
                log(`FIFO generated ${fifo2025.length} operations for 2025.`);
            } catch (e: any) {
                log('FIFO Calc Error: ' + e.message);
            }
        }

        // 3. Check Net Worth (Dashboard Source)
        log('\n--- DASHBOARD NET WORTH CHECK ---');
        const positions = await sql`SELECT * FROM positions WHERE portfolio_id = ${p.id}`;
        let totalVal = 0;

        for (const pos of positions) {
            let price = Number(pos.average_buy_price);
            let rate = 1.0;

            try {
                const quote = await MarketDataService.getQuote(pos.ticker);
                const r = await MarketDataService.getExchangeRate(pos.currency, 'EUR');

                log(`[${pos.ticker}] Qty:${pos.quantity} Cur:${pos.currency}`);
                log(`   -> Market Price: ${quote.c} (prev: ${quote.pc})`);
                log(`   -> FX Rate: ${r}`);

                if (quote.c) price = quote.c;
                if (r && r > 0) rate = r;
            } catch (e: any) {
                log(`   -> API Error for ${pos.ticker}: ${e.message}`);
            }

            const val = Number(pos.quantity) * price * rate;
            totalVal += val;
            log(`   -> Value EUR: ${val.toFixed(2)}`);
        }
        log(`\nCalculated Net Worth: ${totalVal.toFixed(2)} EUR`);

        await Bun.write('server/debug_result.txt', logBuffer.join('\n'));

    } catch (e: any) {
        console.error(e);
        await Bun.write('server/debug_result.txt', logBuffer.join('\n') + '\nERROR: ' + e.message);
    }
    process.exit(0);
};

run();
