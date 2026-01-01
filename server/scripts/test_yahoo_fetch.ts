
const run = async () => {
    const ticker = 'AAPL';
    console.log(`--- FETCHING ${ticker} DIRECTLY ---`);
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
        const res = await fetch(url);
        if (!res.ok) {
            console.log(`❌ Status: ${res.status} ${res.statusText}`);
            const txt = await res.text();
            console.log(`   Body: ${txt}`);
            return;
        }

        const data = await res.json();
        const meta = data.chart?.result?.[0]?.meta;

        if (meta) {
            console.log(`✅ Success! Price: ${meta.regularMarketPrice} ${meta.currency}`);
            console.log(`   Prev Close: ${meta.chartPreviousClose}`);
        } else {
            console.log('❌ Invalid data structure:', JSON.stringify(data));
        }

    } catch (e: any) {
        console.log(`❌ Fetch Error: ${e.message}`);
    }
};

run();
