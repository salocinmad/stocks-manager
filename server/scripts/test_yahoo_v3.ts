
const run = async () => {
    console.log('--- TESTING YAHOO FINANCE V3 (REQUIRE) ---');
    try {
        const yahooFinance = require('yahoo-finance2').default;
        console.log('Loaded via require.default');
        console.log('Type:', typeof yahooFinance);

        console.log('Attempting fetch AAPL...');
        const result = await yahooFinance.quote('AAPL');
        console.log(`✅ Result: ${result.regularMarketPrice} ${result.currency}`);
    } catch (e: any) {
        console.error('❌ Error:', e.message);
    }
};

run();
