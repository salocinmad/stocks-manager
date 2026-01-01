
import { MarketDataService } from '../services/marketData';

async function runSync() {
    console.log('--- STARTING 5-YEAR HISTORY SYNC ---');
    console.log('This will fetch 5 years of daily data for ALL tickers in ALL portfolios.');

    // Explicitly requesting 5 years (60 months)
    await MarketDataService.syncPortfolioHistory(60);

    console.log('--- SYNC COMPLETE ---');
    console.log('Use investigate_data.ts to verify specific tickers.');
    process.exit(0);
}

runSync();
