
import { MarketDataService } from '../services/marketData';
import { SettingsService } from '../services/settingsService';

// Mock console for timestamp (if not using index.ts override)
// But we can just use normal console for debug script

async function testFinnhub() {
    console.log('--- Testing Finnhub Discovery ---');

    // Load Env
    await SettingsService.loadToEnv();
    const key = process.env.FINNHUB_API_KEY;
    console.log(`API Key present: ${key ? 'YES' : 'NO'} (${key?.substring(0, 4)}...)`);

    if (!key) {
        console.error('No API Key found. Aborting.');
        return;
    }

    const category = 'technology';
    console.log(`Fetching News for category: ${category}...`);

    const url = `https://finnhub.io/api/v1/news?category=${category}&token=${key}`;
    console.log(`URL: ${url.replace(key, 'HIDDEN')}`);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error('Response NOT OK:', response.status, response.statusText);
            const text = await response.text();
            console.error('Body:', text);
            return;
        }

        const data = await response.json();
        console.log(`Got ${Array.isArray(data) ? data.length : 'Not Array'} items.`);

        if (Array.isArray(data)) {
            // Check first 5 items
            console.log('First 5 items sample:');
            data.slice(0, 5).forEach((item, i) => {
                console.log(`[${i}] ID: ${item.id}, Date: ${new Date(item.datetime * 1000).toISOString()}`);
                console.log(`    Headline: ${item.headline}`);
                console.log(`    Related: "${item.related}"`);
            });

            // Count valid tickers
            let tickerCount = 0;
            const tickers = new Set<string>();
            data.forEach((item) => {
                if (item.related && item.related.trim() !== '') {
                    item.related.split(',').forEach((t: string) => {
                        if (t.trim()) {
                            tickers.add(t.trim());
                            tickerCount++;
                        }
                    });
                }
            });
            console.log(`Total Tickers found: ${tickerCount}`);
            console.log(`Unique Tickers: ${tickers.size}`);
            console.log('Tickers:', Array.from(tickers).slice(0, 10));
        }

    } catch (e) {
        console.error('Fetch Error:', e);
    }
}

testFinnhub().catch(console.error);
