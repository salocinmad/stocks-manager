
import { MarketDataService } from '../services/marketData';

const run = async () => {
    console.log('--- VERIFYING SEARCH FUNCTIONALITY ---');

    const queries = [
        { type: 'Name', q: 'Apple' },
        { type: 'Ticker', q: 'TEF.MC' },
        { type: 'ISIN', q: 'US0378331005' }, // User mentioned ISIN fails
        { type: 'ISIN 2', q: 'ES0178430E18' } // Telefonica
    ];

    for (const item of queries) {
        console.log(`\nSearching for [${item.type}]: "${item.q}"`);
        try {
            // The route uses searchSymbols directly
            const results = await MarketDataService.searchSymbols(item.q);
            console.log(`Found ${results.length} results.`);
            if (results.length > 0) {
                results.slice(0, 3).forEach(r => {
                    console.log(`   -> [${r.symbol}] ${r.name} (${r.exchange}) Type:${r.type}`);
                });
            } else {
                console.log('❌ No results found.');

                // If ISIN fails via searchSymbols, maybe the frontend uses a different endpoint for ISIN?
                // Let's check getTickerByISIN logic too if searchSymbols returns empty.
                if (item.type.includes('ISIN')) {
                    console.log('   Attempting getTickerByISIN fallback...');
                    const ticker = await MarketDataService.getTickerByISIN(item.q);
                    console.log(`   -> getTickerByISIN returned: ${ticker}`);
                }
            }
        } catch (e: any) {
            console.log(`❌ Error: ${e.message}`);
        }
    }
};

run();
