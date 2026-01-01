
import { MarketDataService } from '../services/marketData';

async function testFinnhub() {
    const ticker = 'AAPL'; // ASTS might be premium on Finnhub, trying AAPL first to verify endpoint
    const apiKey = process.env.FINNHUB_API_KEY;

    if (!apiKey) {
        console.error('No FINNHUB_API_KEY found.');
        return;
    }

    console.log(`Testing Finnhub for ${ticker} with key ending in ...${apiKey.slice(-4)}`);

    // 1. Recommendation Trends
    try {
        const recUrl = `https://finnhub.io/api/v1/stock/recommendation?symbol=${ticker}&token=${apiKey}`;
        const recRes = await fetch(recUrl);
        const recData = await recRes.json();
        console.log('\n--- RECOMMENDATION TRENDS ---');
        console.log(recData.slice(0, 2)); // Show recent 2
    } catch (e) {
        console.error('Rec Error:', e.message);
    }

    // 2. Peers (Competitors)
    try {
        const peerUrl = `https://finnhub.io/api/v1/stock/peers?symbol=${ticker}&token=${apiKey}`;
        const peerRes = await fetch(peerUrl);
        const peers = await peerRes.json();
        console.log('\n--- PEERS ---');
        console.log(peers);
    } catch (e) {
        console.error('Peers Error:', e.message);
    }

    // 3. Insider Sentiment (Premium?)
    try {
        const insUrl = `https://finnhub.io/api/v1/stock/insider-sentiment?symbol=${ticker}&from=2025-01-01&token=${apiKey}`;
        const insRes = await fetch(insUrl);
        const insData = await insRes.json();
        console.log('\n--- INSIDER SENTIMENT ---');
        console.log(insData);
    } catch (e) {
        console.error('Insider Error:', e.message);
    }
}

testFinnhub();
