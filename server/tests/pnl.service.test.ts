import { describe, expect, test, mock } from "bun:test";
import { PnLService } from "../services/pnlService";

describe("PnL Service (Pure Calculation)", () => {

    // TEST: Daily PnL Calculation (Pure unit test - no DB)
    test("should calculate exact Unrealized PnL in EUR", () => {
        const positions = [
            { ticker: "AAPL", quantity: 10, averagePrice: 100, currency: "USD" }
        ];

        // Scenario:
        // Bought 10 AAPL @ $100 (Total Cost $1000)
        // Current Price: $110
        // FX Rate (USD -> EUR): 0.90

        // Cost Basis in EUR = 10 * 100 * 0.90 = 900 EUR
        // Market Value in EUR = 10 * 110 * 0.90 = 990 EUR
        // Expected PnL = 990 - 900 = +90 EUR

        const prices = { "AAPL": 110 };
        const rates = { "USD": 0.90 };

        const pnl = PnLService.calculateDailyUnrealizedPnL(positions, prices, rates);

        expect(pnl).toBe(90.00);
    });

    test("should handle multiple positions and currencies", () => {
        const positions = [
            { ticker: "AAPL", quantity: 10, averagePrice: 100, currency: "USD" }, // Gain 90 EUR (from prev test)
            { ticker: "SAN.MC", quantity: 100, averagePrice: 3.50, currency: "EUR" } // EUR Stock
        ];

        // SAN scenario:
        // Cost: 100 * 3.50 = 350 EUR
        // Price: 3.40 (Loss)
        // Value: 100 * 3.40 = 340 EUR
        // PnL: -10 EUR

        // Total PnL = 90 - 10 = 80 EUR

        const prices = { "AAPL": 110, "SAN.MC": 3.40 };
        const rates = { "USD": 0.90, "EUR": 1.0 };

        const pnl = PnLService.calculateDailyUnrealizedPnL(positions, prices, rates);

        expect(pnl).toBe(80.00);
    });

    test("should handle floating point precision (rounding)", () => {
        const positions = [
            { ticker: "X", quantity: 3, averagePrice: 33.333333, currency: "EUR" }
        ];
        // Cost: 99.999999 EUR
        // Price: 33.333333
        // Value: 99.999999
        // PnL ~ 0

        const prices = { "X": 33.333333 };
        const rates = { "EUR": 1.0 };

        const pnl = PnLService.calculateDailyUnrealizedPnL(positions, prices, rates);

        expect(pnl).toBe(0.00);
    });
});
