import { describe, expect, test, mock, beforeEach, afterEach, afterAll } from "bun:test";
import { MarketDataService } from "../services/marketData";
import sql from "../db";

// No marking module '../db' anymore. We use the real one.

describe("MarketDataService (Integration)", () => {
    const originalFetch = global.fetch;

    beforeEach(async () => {
        // Clean up cache tables
        await sql`DELETE FROM market_cache`;
        await sql`DELETE FROM historical_data WHERE ticker IN ('AAPL', 'MSFT', 'INVALID')`;

        // Mock fetch default
        // @ts-ignore
        global.fetch = mock(() => Promise.resolve(new Response(JSON.stringify({}))));
    });

    afterAll(() => {
        global.fetch = originalFetch;
    });

    test("should return cached quote if present in DB", async () => {
        const ticker = "AAPL";
        const cachedData = {
            c: 150,
            currency: "USD",
            name: "Apple Inc",
            lastUpdated: Date.now(),
            state: 'REGULAR',
            exchange: 'NASDAQ'
        };

        // Insert directly into DB
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour future
        await sql`
            INSERT INTO market_cache (key, data, expires_at)
            VALUES (${`quote:${ticker}`}, ${cachedData}, ${expiresAt})
        `;

        // Verify insertion
        const check = await sql`SELECT * FROM market_cache WHERE key = ${`quote:${ticker}`}`;
        console.log('DEBUG: Cache Row:', check);

        const result = await MarketDataService.getQuote(ticker);

        expect(result).toBeDefined();
        expect(result?.c).toBe(150);
        expect(result?.name).toBe("Apple Inc");

        // Should NOT hit fetch because cache hit
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test("should fetch from API if cache misses and save to DB", async () => {
        const ticker = "MSFT";
        const yahooResponse = {
            chart: {
                result: [{
                    meta: {
                        currency: "USD",
                        symbol: "MSFT",
                        exchangeName: "NASDAQ",
                        regularMarketPrice: 300,
                        chartPreviousClose: 295,
                        regularMarketVolume: 1000000,
                        currentTradingPeriod: { tradingPeriod: "REGULAR" }
                    },
                    timestamp: [1234567890],
                    indicators: { quote: [{ close: [300] }] }
                }]
            }
        };

        // Mock Fetch response
        // @ts-ignore
        global.fetch = mock(() => Promise.resolve(new Response(JSON.stringify(yahooResponse), { status: 200, statusText: "OK" })));

        const result = await MarketDataService.getQuote(ticker);

        expect(result).not.toBeNull();
        expect(result?.c).toBe(300);
        expect(result?.state).toBe("REGULAR");
        expect(global.fetch).toHaveBeenCalledTimes(1);

        // Verify it was saved to DB
        const cache = await sql`SELECT data FROM market_cache WHERE key = ${`quote:${ticker}`}`;
        expect(cache.length).toBe(1);
        expect(cache[0].data.c).toBe(300);
    });

    test("should handle API failure gracefully", async () => {
        const ticker = "INVALID";

        // Mock Fetch Error
        // @ts-ignore
        global.fetch = mock(() => Promise.resolve(new Response("Not Found", { status: 404, statusText: "Not Found" })));

        const result = await MarketDataService.getQuote(ticker);

        expect(result).toBeNull();
    });
});
