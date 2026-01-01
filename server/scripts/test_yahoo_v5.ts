
// @ts-ignore
import { quote } from 'yahoo-finance2';

const run = async () => {
    console.log('--- TESTING YAHOO FINANCE V5 (NAMED) ---');
    try {
        console.log('Type of quote:', typeof quote);
        if (typeof quote === 'function') {
            console.log('Attempting fetch AAPL...');
            const result = await quote('AAPL');
            console.log(`✅ Success: ${result.regularMarketPrice}`);
        } else {
            console.log('❌ Quote is not a function');
        }
    } catch (e: any) {
        console.log('❌ Error:', e.message);
    }
};

run();
