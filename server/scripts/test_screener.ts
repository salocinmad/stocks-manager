
import YahooFinance from 'yahoo-finance2';
const yf = new YahooFinance();

async function test() {
    console.log('Testing Day Gainers (Predefined)...');
    try {
        // Try standard invocation for predefined
        const r1 = await yf.screener({ scrIds: 'ms_technology', count: 5 });
        console.log('Success (ms_technology):', r1.quotes?.length);
    } catch (e) {
        console.error('Error (ms_technology):', e.message);
    }

    console.log('Testing ms_technology with options...');
    try {
        const r2 = await yf.screener({ scrIds: 'ms_technology', count: 5 }, { validateResult: false });
        console.log('Success (With ValidateResult=false):', r2.quotes?.length);
    } catch (e) {
        console.error('Error (With ValidateResult=false):', e.message);
    }
}

test();
