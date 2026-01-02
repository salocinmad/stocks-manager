import { describe, expect, test, mock, beforeEach, afterEach, afterAll } from "bun:test";
import sql from "../db";

// Mock yahoo-finance2 module BEFORE importing the service
mock.module("yahoo-finance2", () => {
    return {
        default: class MockYahooFinance {
            screener() { return Promise.resolve({ quotes: [] }); }

            // Note: quoteCombine is an instance method in the real library if used via new YahooFinance()
            // However, marketData.ts might be using the default instance or the class.
            // Based on "const yahooFinance = new YahooFinance()", it uses the class instance.
            // The method called is "yahooFinance.quoteCombine" (if it existed) or "yahooFinance.quote".
            // Let's mock 'quote' as usually that's the method, but marketData uses 'getQuote' wrapper.
            // Let's check marketData source again... it calls: "yahooFinance.screener".
            // Does it call quote? It uses global fetch for quotes in v8!
            // Wait, marketData.ts line 272: "const url = ... fetch(url)". 
            // It ONLY uses yahoo-finance2 for SCREENER (line 99).
            // It uses GLOBAL FETCH for getQuote.
            //
            // WAIT! The verify failure was "Received: 483.62". 
            // My previous analysis said "marketDataService was updated to use yahoo-finance2".
            // BUT looking at `marketData.ts` line 272:
            //    async getQuote(ticker: string): Promise<QuoteResult | null> {
            //        const url = "https://query1.finance.yahoo.com/v8/finance/chart/" ...
            //        const response = await fetch(url ...)
            //
            // So getQuote STILL USES FETCH!
            // The tests failed because I removed the `global.fetch` mock in my previous edit!
            //
            // CORRECTION: I need to mock `global.fetch` again because `marketData.ts` uses it for quotes.
            // `yahoo-finance2` is only used for Discovery (Screener).

            // I will restore global.fetch mock.
        }
    };
});

describe("MarketDataService (Integration)", () => {
    // We can use static import if we mock fetch, as fetch is global.
    // The previous failure was because I REMOVED the fetch mock thinking it was replaced by library.
    // I will restore the fetch mock.

    const originalFetch = global.fetch;

    beforeEach(async () => {
        // Clean up cache tables
        await sql`DELETE FROM market_cache`;
        await sql`DELETE FROM historical_data WHERE ticker IN ('AAPL', 'MSFT', 'INVALID')`;

        // Mock fetch default
        // @ts-ignore
        global.fetch = mock((url: string | Request) => {
            const urlStr = url.toString();

            if (urlStr.includes("MSFT")) {
                return Promise.resolve(new Response(JSON.stringify({
                    chart: {
                        result: [{
                            meta: {
                                currency: "USD",
                                symbol: "MSFT",
                                exchangeName: "NASDAQ",
                                regularMarketPrice: 300,
                                chartPreviousClose: 295,
                                regularMarketVolume: 1000000,
                                marketState: "REGULAR", // Explicitly set state to avoid timestamp calc issues
                                currentTradingPeriod: { tradingPeriod: "REGULAR" }
                            },
                            timestamp: [1234567890],
                            indicators: { quote: [{ close: [300] }] }
                        }]
                    }
                }), { status: 200 }));
            }

            if (urlStr.includes("INVALID")) {
                return Promise.resolve(new Response("Not Found", { status: 404 }));
            }

            return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
        });
    });

    afterAll(() => {
        global.fetch = originalFetch;
    });

    // Re-import service statically since we rely on global fetch mock
    const { MarketDataService } = require("../services/marketData");

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

        const expiresAt = new Date(Date.now() + 1000 * 60 * 60);
        await sql`
            INSERT INTO market_cache (key, data, expires_at)
            VALUES (${`quote:${ticker}`}, ${cachedData}, ${expiresAt})
        `;

        const result = await MarketDataService.getQuote(ticker);

        expect(result).toBeDefined();
        expect(result?.c).toBe(150);
        expect(result?.name).toBe("Apple Inc");
    });

    test("should fetch from API (mocked) if cache misses and save to DB", async () => {
        const ticker = "MSFT";

        const result = await MarketDataService.getQuote(ticker);

        expect(result).not.toBeNull();
        expect(result?.c).toBe(300);
        expect(result?.state).toBe("REGULAR");

        const cache = await sql`SELECT data FROM market_cache WHERE key = ${`quote:${ticker}`}`;
        expect(cache.length).toBe(1);
        expect(cache[0].data.c).toBe(300);
    });

    test("should handle API failure gracefully", async () => {
        const ticker = "INVALID";
        const result = await MarketDataService.getQuote(ticker);
        expect(result).toBeNull();
    });
});
