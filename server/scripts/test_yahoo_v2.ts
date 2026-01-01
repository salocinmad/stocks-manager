
// @ts-ignore
import yahooFinance from 'yahoo-finance2';

const run = async () => {
    console.log('--- TESTING YAHOO FINANCE V2 ---');
    try {
        console.log('Use default?', !!yahooFinance.default);
        const yf = yahooFinance.default || yahooFinance;
        console.log('Is YF defined?', !!yf);

        console.log('Attempting fetch AAPL...');
        const result = await yf.quote('AAPL');
        console.log(`✅ Result: ${result.regularMarketPrice} ${result.currency}`);
    } catch (e: any) {
        console.error('❌ Error:', e.message);
    }
};

run();
