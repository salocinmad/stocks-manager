import { describe, expect, test, mock, beforeEach, afterAll } from "bun:test";
import sql from "../db";

describe("MarketDataService GBX Support", () => {
    const originalFetch = global.fetch;

    beforeEach(async () => {
        await sql`DELETE FROM market_cache`;

        // Mock fetch for Exchange Rates
        // @ts-ignore
        global.fetch = mock((url: string | Request) => {
            const urlStr = url.toString();

            if (urlStr.includes("GBPEUR=X")) {
                return Promise.resolve(new Response(JSON.stringify({
                    chart: { result: [{ meta: { currency: "EUR", symbol: "GBPEUR=X", regularMarketPrice: 1.2 }, timestamp: [1234567890], indicators: { quote: [{ close: [1.2] }] } }] }
                }), { status: 200 }));
            }

            if (urlStr.includes("EURGBP=X")) {
                return Promise.resolve(new Response(JSON.stringify({
                    chart: { result: [{ meta: { currency: "GBP", symbol: "EURGBP=X", regularMarketPrice: 0.8 }, timestamp: [1234567890], indicators: { quote: [{ close: [0.8] }] } }] }
                }), { status: 200 }));
            }

            return Promise.resolve(new Response(JSON.stringify({}), { status: 404 }));
        });
    });

    afterAll(() => {
        global.fetch = originalFetch;
    });

    const { MarketDataService } = require("../services/marketData");

    test("should convert GBX to EUR as (GBP->EUR / 100)", async () => {
        // GBX -> EUR should use GBP -> EUR rate (1.2) * 0.01 = 0.012
        const rate = await MarketDataService.getExchangeRate('GBX', 'EUR');
        expect(rate).toBeCloseTo(0.012, 4);
    });

    test("should convert EUR to GBX as (EUR->GBP * 100)", async () => {
        // EUR -> GBX should use EUR -> GBP rate (0.8) * 100 = 80
        const rate = await MarketDataService.getExchangeRate('EUR', 'GBX');
        expect(rate).toBeCloseTo(80.0, 1);
    });
});
