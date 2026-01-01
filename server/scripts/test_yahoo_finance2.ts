// Quick test to see if yahoo-finance2 v3 is working again
import YahooFinance from 'yahoo-finance2';

async function testYahooFinance2() {
    console.log('Testing yahoo-finance2 v3 library...\n');

    // V3 requires instantiation
    const yahooFinance = new YahooFinance();

    const testTickers = ['AAPL', 'DIA.MC', 'MSFT'];

    for (const ticker of testTickers) {
        console.log(`\n--- Testing ${ticker} ---`);

        try {
            // Test quote
            console.log('1. Testing quote()...');
            const quote = await yahooFinance.quote(ticker);
            console.log(`   ✅ Quote OK: ${quote.regularMarketPrice} ${quote.currency}`);

            // Test quoteSummary for sector
            console.log('2. Testing quoteSummary() for sector...');
            const summary = await yahooFinance.quoteSummary(ticker, { modules: ['summaryProfile'] });
            const sector = summary.summaryProfile?.sector || 'N/A';
            const industry = summary.summaryProfile?.industry || 'N/A';
            console.log(`   ✅ Sector: ${sector}, Industry: ${industry}`);

        } catch (e: any) {
            console.log(`   ❌ Error: ${e.message}`);
        }
    }

    console.log('\n=== Test Complete ===');
}

testYahooFinance2();
