import { describe, expect, test, mock, beforeEach, afterEach, afterAll, beforeAll } from "bun:test";
import { PortfolioService } from "../services/portfolioService";
import sql from "../db";

describe("PortfolioService Logic (Integration)", () => {

    const cleanupIds: string[] = [];
    const registerCleanup = (id: string) => cleanupIds.push(id);

    // Clean up any stale test users from previous failed runs
    beforeAll(async () => {
        // Safe cleanup targeting only test emails
        await sql`DELETE FROM users WHERE email LIKE 'logic_%'`;
    });

    // Helper to setup context
    const setup = async () => {
        const userId = crypto.randomUUID();
        const portId = crypto.randomUUID();
        const uniqueEmail = `logic_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`;

        await sql`INSERT INTO users (id, email, password_hash, full_name, role) VALUES (${userId}, ${uniqueEmail}, 'hash', 'Test', 'user')`;
        await sql`INSERT INTO portfolios (id, user_id, name) VALUES (${portId}, ${userId}, 'Test Port')`;

        return { userId, portId };
    };

    afterEach(async () => {
        if (cleanupIds.length > 0) {
            await sql`DELETE FROM users WHERE id IN ${sql(cleanupIds)}`;
            cleanupIds.length = 0;
        }
    });

    test("should calculate effective price correctly for INITIAL BUY with commission", async () => {
        const { userId, portId } = await setup();
        registerCleanup(userId);

        const amount = 10;
        const price = 100; // Price per unit
        const commission = 5;
        // Logic V2: Store Raw Price (100) and Commission (5) separately.

        await PortfolioService.addTransaction(portId, "AAPL", "BUY", amount, price, "USD", commission);

        // Check Position
        const [pos] = await sql`SELECT * FROM positions WHERE portfolio_id = ${portId} AND ticker = 'AAPL'`;

        expect(pos).toBeDefined();
        expect(Number(pos.quantity)).toBe(10);

        // Expect RAW price, not effective price
        expect(Number(pos.average_buy_price)).toBe(100);
        expect(Number(pos.commission)).toBe(5);
    });

    test("should calculate WEIGHTED AVERAGE price correctly for ADDING to position", async () => {
        const { userId, portId } = await setup();
        registerCleanup(userId);

        // 1. Initial Buy: 10 @ 100, Comm 0
        await PortfolioService.addTransaction(portId, "AAPL", "BUY", 10, 100, "USD", 0);

        // 2. Second Buy: 10 @ 200, Comm 0
        // Total Cost (Raw) = 1000 + 2000 = 3000
        // Total Qty = 20
        // Avg = 150
        await PortfolioService.addTransaction(portId, "AAPL", "BUY", 10, 200, "USD", 0);

        const [pos] = await sql`SELECT * FROM positions WHERE portfolio_id = ${portId} AND ticker = 'AAPL'`;

        expect(Number(pos.quantity)).toBe(20);
        expect(Number(pos.average_buy_price)).toBe(150.0);
    });

    test("should NOT change average price on SELL, only quantity", async () => {
        const { userId, portId } = await setup();
        registerCleanup(userId);

        // Initial: 20 units @ 150.0
        await PortfolioService.addTransaction(portId, "AAPL", "BUY", 20, 150, "USD", 0);

        // Sell: 5 units @ 300
        await PortfolioService.addTransaction(portId, "AAPL", "SELL", 5, 300, "USD", 0);

        const [pos] = await sql`SELECT * FROM positions WHERE portfolio_id = ${portId} AND ticker = 'AAPL'`;

        expect(Number(pos.quantity)).toBe(15);
        expect(Number(pos.average_buy_price)).toBe(150.0);
    });

    test("should throw error if selling more than owned", async () => {
        const { userId, portId } = await setup();
        registerCleanup(userId);

        // Own 5
        await PortfolioService.addTransaction(portId, "AAPL", "BUY", 5, 100, "USD", 0);

        // Try to Sell 10
        // expect to throw
        let error;
        try {
            await PortfolioService.addTransaction(portId, "AAPL", "SELL", 10, 100, "USD", 0);
        } catch (e) {
            error = e;
        }

        expect(error).toBeDefined();
    });
});
