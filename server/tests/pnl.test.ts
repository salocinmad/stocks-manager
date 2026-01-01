import { describe, expect, test, mock, beforeEach, afterEach, afterAll } from "bun:test";
import { calculatePnLDaily } from "../jobs/pnlJob";
import { MarketDataService } from "../services/marketData";
import sql from "../db";

// PnL Job Integration test - requires real DB and mocked external services
// This test verifies the job runs without errors, not specific calculations

describe("PnL Job Logic (Integration)", () => {
    // Mock MarketDataService methods to prevent real API calls
    const originalGetDetailedHistory = MarketDataService.getDetailedHistory;
    const originalSyncCurrencyHistory = MarketDataService.syncCurrencyHistory;
    const originalGetQuote = MarketDataService.getQuote;
    const originalGetExchangeRate = MarketDataService.getExchangeRate;

    const mockGetDetailedHistory = mock(() => Promise.resolve(true));
    const mockSyncCurrencyHistory = mock(() => Promise.resolve());
    const mockGetQuote = mock(() => Promise.resolve({ c: 100, currency: "USD" }));
    const mockGetExchangeRate = mock(() => Promise.resolve(0.92));

    beforeEach(() => {
        mockGetDetailedHistory.mockClear();
        mockSyncCurrencyHistory.mockClear();
        mockGetQuote.mockClear();
        mockGetExchangeRate.mockClear();

        // @ts-ignore
        MarketDataService.getDetailedHistory = mockGetDetailedHistory;
        // @ts-ignore
        MarketDataService.syncCurrencyHistory = mockSyncCurrencyHistory;
        // @ts-ignore
        MarketDataService.getQuote = mockGetQuote;
        // @ts-ignore
        MarketDataService.getExchangeRate = mockGetExchangeRate;
    });

    afterAll(() => {
        // @ts-ignore
        MarketDataService.getDetailedHistory = originalGetDetailedHistory;
        // @ts-ignore
        MarketDataService.syncCurrencyHistory = originalSyncCurrencyHistory;
        // @ts-ignore
        MarketDataService.getQuote = originalGetQuote;
        // @ts-ignore
        MarketDataService.getExchangeRate = originalGetExchangeRate;
    });

    test("should run daily PnL calculation without throwing", async () => {
        // Simply verify the job runs without errors
        // The job processes ALL portfolios in the DB, so we just check it completes
        await calculatePnLDaily();
        expect(true).toBe(true); // Explicit pass
    });
});
