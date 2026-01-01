
const run = async () => {
    // Yahoo format for USD to EUR is usually USDEUR=X or EURUSD=X (inverted)
    // Let's check USDEUR=X first as that's what we likely need for converting USD assets to EUR.
    const ticker = 'USDEUR=X';
    console.log(`--- VERIFYING HISTORICAL FOREX FOR ${ticker} ---`);

    try {
        // Range: 1y (covers "8 months ago"), Interval: 1d
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y`;
        console.log(`Fetching: ${url}`);

        const res = await fetch(url);
        if (!res.ok) {
            console.log(`❌ Fetch Failed: ${res.status} ${res.statusText}`);
            return;
        }

        const data = await res.json();
        const result = data.chart?.result?.[0];

        if (!result) {
            console.log('❌ No result found');
            return;
        }

        const timestamps = result.timestamp || [];
        const quotes = result.indicators?.quote?.[0] || {};

        console.log(`Found ${timestamps.length} daily rates.`);

        if (timestamps.length > 0) {
            // Find a date roughly 8 months ago (Approx May 2025 given current is Dec 2025)
            // Wait, current date in metadata is 2025-12-31. 8 months ago is April/May 2025.

            const targetMonth = 4; // May (0-indexed is 4)

            const sample = timestamps.map((ts: number, i: number) => ({
                date: new Date(ts * 1000),
                rate: quotes.close[i]
            })).find((item: any) => item.date.getMonth() === targetMonth && item.date.getDate() === 15); // Mid-May

            if (sample) {
                console.log(`✅ Found sample rate for ${sample.date.toISOString().split('T')[0]}: ${sample.rate}`);
            } else {
                console.log('⚠️ Could not find exact sample date, but data exists.');
                // Show first and last
                const first = new Date(timestamps[0] * 1000);
                const last = new Date(timestamps[timestamps.length - 1] * 1000);
                console.log(`   Range: ${first.toISOString()} to ${last.toISOString()}`);
            }
        }

    } catch (e: any) {
        console.log(`❌ Error: ${e.message}`);
    }
};

run();
