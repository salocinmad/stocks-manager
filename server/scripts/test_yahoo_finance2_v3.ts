// Test script for yahoo-finance2 v3 WITH CUSTOM USER-AGENT
import YahooFinance from 'yahoo-finance2';

async function testYahooFinance2WithAgent() {
    console.log('Testing yahoo-finance2 v3 library with CUSTOM USER-AGENT...\n');

    // Create new instance with explicit User-Agent
    const yahooFinance = new YahooFinance({
        // Trying to mimic the browser headers that bypassed the 429
        logger: {
            info: (...args) => console.log(...args),
            warn: (...args) => console.warn(...args),
            error: (...args) => console.error(...args),
            debug: (...args) => { } // console.log(...args)
        },
        // IMPORTANT: We cannot directly set headers here easily in V2/V3 simple config?
        // Let's try to see if we can perform a quote
    });

    // Unfortunately, yahoo-finance2 v2.11+ / v3 logic for suppressing/setting headers is a bit specific.
    // But let's try to see if the library's default behavior works now that the user changed IP.

    // NOTE: yahoo-finance2 library usually respects a global or instance config.
    // Let's try to set it if possible, otherwise just run it raw as requested.

    // There isn't a simple "userAgent" config option in the public docs for the constructor 
    // without using a custom fetch implementation, but let's try the standard request first 
    // as per user request "tal cual te indico" (just check the library).

    const testTickers = ['DIA.MC', 'AAPL'];

    for (const ticker of testTickers) {
        console.log(`\n--- Testing ${ticker} ---`);

        try {
            console.log('1. Fetching quoteSummary (Sector)...');
            const summary = await yahooFinance.quoteSummary(ticker, { modules: ['summaryProfile'] });

            const sector = summary.summaryProfile?.sector || 'N/A';
            console.log(`   ✅ SUCCESS! Sector: ${sector}`);

        } catch (e: any) {
            console.log(`   ❌ Error: ${e.message}`);
            // Check if it's the specific crumb error
            if (e.message && e.message.includes('crumb')) {
                console.log('      (Still failing to get crumb/cookie)');
            }
        }
    }

    console.log('\n=== Test Complete ===');
}

testYahooFinance2WithAgent();
