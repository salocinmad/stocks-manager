import yahooFinance from 'yahoo-finance2';

const run = async () => {
    console.log('--- TESTING YAHOO FINANCE IMPORT ---');
    console.log('Type of yahooFinance:', typeof yahooFinance);
    console.log('Keys:', Object.keys(yahooFinance || {}));

    // Attempt adapting to the error hint
    // @ts-ignore
    const yf = yahooFinance.default || yahooFinance;

    const tickers = ['AAPL'];

    for (const t of tickers) {
        console.log(`\nFetching ${t}...`);
        try {
            const result = await yf.quote(t);
            console.log(`✅ Success ${t}: ${result.regularMarketPrice}`);
        } catch (e: any) {
            console.log(`❌ Failed ${t}: ${e.message}`);
        }
    }
};

run();
