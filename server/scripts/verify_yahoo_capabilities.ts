
const run = async () => {
    const ticker = 'AAPL';
    console.log(`--- VERIFYING YAHOO CAPABILITIES FOR ${ticker} ---`);

    try {
        // 1. CHART API (Used for Quotes + History)
        // Fetch 5 days of history to verify closing prices array
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d`;
        console.log(`Fetching: ${url}`);

        const res = await fetch(url);
        if (!res.ok) {
            console.log(`❌ Fetch Failed: ${res.status}`);
            return;
        }

        const data = await res.json();
        const result = data.chart?.result?.[0];

        if (!result) {
            console.log('❌ No result found');
            return;
        }

        // 2. CHECK METADATA (Quote Info)
        const meta = result.meta;
        console.log('\n--- METADATA ---');
        console.log(`Symbol: ${meta.symbol}`);
        console.log(`Price: ${meta.regularMarketPrice} ${meta.currency}`);
        console.log(`Prev Close: ${meta.chartPreviousClose}`);
        console.log(`Volume: ${meta.regularMarketVolume}`);
        console.log(`Market State: ${meta.marketState} (Trading Periods: ${!!meta.tradingPeriods})`);

        // 3. CHECK HISTORY
        console.log('\n--- HISTORY (5 Days) ---');
        const timestamps = result.timestamp || [];
        const quotes = result.indicators?.quote?.[0] || {};

        if (timestamps.length > 0 && quotes.close) {
            console.log(`Found ${timestamps.length} data points.`);
            timestamps.forEach((ts: number, i: number) => {
                const date = new Date(ts * 1000).toISOString().split('T')[0];
                const close = quotes.close[i]?.toFixed(2);
                console.log(`   [${date}] Close: ${close}`);
            });
        } else {
            console.log('❌ No historical data points found.');
        }

    } catch (e: any) {
        console.log(`❌ Error: ${e.message}`);
    }
};

run();
