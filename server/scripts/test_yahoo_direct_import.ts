
// @ts-ignore
import yahooFinance from 'yahoo-finance2/esm/src/index.js';

const run = async () => {
    console.log('--- TESTING DIRECT IMPORT ---');
    console.log('Type of import:', typeof yahooFinance);
    console.log('Keys:', Object.keys(yahooFinance || {}));

    // Check if it is the default export object
    const yf = yahooFinance.default || yahooFinance;

    if (yf && typeof yf.quote === 'function') {
        console.log('Found .quote(). Calling...');
        try {
            const res = await yf.quote('AAPL');
            console.log(`✅ SUCCESS! Price=${res.regularMarketPrice}`);
        } catch (e: any) {
            console.log(`❌ FAILED: ${e.message}`);
        }
    } else {
        console.log('No .quote() function on import.');
    }
};

run();
