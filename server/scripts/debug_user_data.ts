
import sql from '../db';
import { PnLService } from '../services/pnlService';
import { MarketDataService } from '../services/marketData';

const run = async () => {
    try {
        console.log('--- DEBUGGING USER DATA ---');

        // 1. Get first portfolio
        const portfolios = await sql`SELECT * FROM portfolios LIMIT 1`;
        if (portfolios.length === 0) {
            console.log('No portfolios found.');
            return;
        }
        const p = portfolios[0];
        console.log(`Portfolio: ${p.name} (${p.id})`);

        // 2. Dump Transactions
        const txs = await sql`SELECT * FROM transactions WHERE portfolio_id = ${p.id} ORDER BY date ASC`;
        console.log(`Found ${txs.length} transactions.`);
        txs.forEach(t => {
            console.log(`[${t.date.toISOString().split('T')[0]}] ${t.type} ${t.ticker} Qty:${t.amount} Price:${t.price_per_unit} ${t.currency}`);
        });

        // 3. Run FIFO Calc
        console.log('\n--- FIFO Calculation Result ---');
        const fifo = await PnLService.calculateRealizedPnL_FIFO(p.id);
        console.log(`FIFO generated ${fifo.length} realized operations.`);
        fifo.forEach(op => {
            console.log(`  Realized: ${op.ticker} Gain:${op.gainEur} EUR (Sell: ${op.sellDate.toISOString().split('T')[0]})`);
        });

        // 4. Check Positions & Market Data (Dashboard Sim)
        console.log('\n--- Dashboard Data Check ---');
        const positions = await sql`SELECT * FROM positions WHERE portfolio_id = ${p.id}`;
        for (const pos of positions) {
            const quote = await MarketDataService.getQuote(pos.ticker);
            const rate = await MarketDataService.getExchangeRate(pos.currency, 'EUR');
            console.log(`Position: ${pos.ticker} Qty:${pos.quantity} Avg:${pos.average_buy_price} ${pos.currency}`);
            console.log(`  -> Market Price: ${quote.c}`);
            console.log(`  -> FX Rate to EUR: ${rate}`);

            const val = Number(pos.quantity) * (quote.c || 0) * (rate || 1);
            console.log(`  -> Est Value EUR: ${val}`);
        }

    } catch (e) {
        console.error(e);
    }
};

run();
