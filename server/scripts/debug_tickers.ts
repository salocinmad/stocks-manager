
import { MarketDataService } from '../services/marketData';
import sql from '../db';

const tickers = ['MSFT', 'TMDX', 'ASTS', 'AMP.MC'];

async function debug() {
    console.log('--- DEBUGGING TICKERS ---');

    for (const ticker of tickers) {
        console.log(`\nChecking ${ticker}...`);

        // 1. Check DB
        const dbCount = await sql`
            SELECT COUNT(*) as count, MIN(date) as min_date, MAX(date) as max_date 
            FROM historical_data WHERE ticker = ${ticker}
        `;
        console.log(`[DB] Count: ${dbCount[0].count}, Range: ${dbCount[0].min_date} to ${dbCount[0].max_date}`);

        // 2. Try Fetch via Service
        try {
            console.log(`[Service] Fetching from Yahoo/Service...`);
            const history = await MarketDataService.getDetailedHistory(ticker, 2);
            console.log(`[Service] Returned ${history.length} records.`);
            if (history.length > 0) {
                console.log(`[Service] First: ${history[0].date}, Last: ${history[history.length - 1].date}`);
            }
        } catch (e) {
            console.error(`[Service] Error fetching ${ticker}:`, e);
        }
    }
    process.exit(0);
}

debug();
