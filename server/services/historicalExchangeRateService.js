import yahooFinance from 'yahoo-finance2';

/**
 * Service to fetch historical exchange rates.
 */

// Cache key: CURRENCY|DATE -> rate
const rateCache = new Map();

export const getHistoricalExchangeRate = async (currency, date) => {
    // Standardize currency
    const normalizedCurrency = currency ? currency.toUpperCase().trim() : 'EUR';

    // Base case: EUR is always 1
    if (normalizedCurrency === 'EUR') {
        return 1;
    }

    // Check cache
    const cacheKey = `${normalizedCurrency}|${date}`;
    if (rateCache.has(cacheKey)) {
        return rateCache.get(cacheKey);
    }

    // Special cases mapping for Yahoo Finance
    // GBP usually is GBP, but sometimes formatted differently. Yahoo ticker: GBPEUR=X
    // USD -> USDEUR=X
    // CAD -> CADEUR=X
    let pairSymbol = `${normalizedCurrency}EUR=X`;

    // Handle "GBp" (pence) if passed (though typically user sees "GBp" but currency code is GBP)
    // If input is strictly "GBp" (pence), we might treat it as GBP then divide, 
    // but usually Yahoo works with currency codes. We assume standard ISO codes.

    try {
        // Yahoo often requires a range. period1 is inclusive, period2 is exclusive? Or just safer to ask for a window.
        // Also handle weekends/holidays by looking back a few days.
        const d = new Date(date);
        const fromDate = new Date(d);
        fromDate.setDate(d.getDate() - 4); // Look back 4 days

        const toDate = new Date(d);
        toDate.setDate(d.getDate() + 2); // Look forward 1-2 days to ensure coverage of "today"

        // Format manually YYYY-MM-DD to allow simple string usage if needed, but Date obj works
        const queryOptions = {
            period1: fromDate.toISOString().split('T')[0],
            period2: toDate.toISOString().split('T')[0],
            interval: '1d'
        };

        console.log(`fetching historical rate for ${pairSymbol} between ${queryOptions.period1} and ${queryOptions.period2}`);

        const result = await yahooFinance.historical(pairSymbol, queryOptions);

        if (result && result.length > 0) {
            // Find the quote closest to the target date (but not in future relative to operation)
            // Filters quotes <= target date
            // The result is usually sorted by date ascending.
            // We want the latest one that is <= target date.

            // Convert target string to time
            const targetTime = new Date(date).getTime();

            // Find valid quotes
            const valid = result.filter(q => new Date(q.date).getTime() <= targetTime);

            if (valid.length > 0) {
                // Last one is the closest to the target date
                const best = valid[valid.length - 1];
                const rate = best.close;
                console.log(`Found rate ${rate} for ${date} (using ${best.date.toISOString().split('T')[0]})`);
                rateCache.set(cacheKey, rate);
                return rate;
            } else if (result.length > 0) {
                // Fallback: use the first available if none before date (unlikely with lookback)
                const rate = result[0].close;
                rateCache.set(cacheKey, rate);
                return rate;
            }
        }

        console.warn(`No historical rate found for ${pairSymbol} around ${date}`);
        return null;
    } catch (e) {
        console.error(`Error fetching historical rate for ${pairSymbol}:`, e.message);
        return null; // Let the user enter it manually if failing
    }
};

export default { getHistoricalExchangeRate };
