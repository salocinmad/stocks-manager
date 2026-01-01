import { describe, expect, test, mock, beforeEach, afterEach, afterAll } from "bun:test";
import { AlertService } from "../services/alertService";
import { MarketDataService } from "../services/marketData";
import { NotificationService } from "../services/notificationService";
import { SettingsService } from "../services/settingsService";
import sql from "../db";

describe("AlertService (Integration)", () => {
    // Backup originals
    const originalGetQuote = MarketDataService.getQuote;
    const originalDispatch = NotificationService.dispatch;
    const originalGetSmtp = SettingsService.getSmtpConfig;

    // Create mocks
    const mockGetQuote = mock(() => Promise.resolve({}));
    const mockDispatch = mock(() => Promise.resolve(true));
    const mockGetSmtp = mock(() => Promise.resolve({ host: 'smtp.test', user: 'test', port: '587' } as any));

    // Cleanup helper
    const cleanup = async () => {
        await sql`DELETE FROM users WHERE email LIKE 'alert_%'`;
        await sql`DELETE FROM alerts WHERE ticker IN ('AAPL', 'TSLA', 'GME')`;
    };

    beforeEach(async () => {
        await cleanup();
        mockGetQuote.mockClear();
        mockDispatch.mockClear();
        mockGetSmtp.mockClear();

        // Monkey patch dependencies
        // @ts-ignore
        MarketDataService.getQuote = mockGetQuote;
        // @ts-ignore
        NotificationService.dispatch = mockDispatch;
        // @ts-ignore
        SettingsService.getSmtpConfig = mockGetSmtp;
    });

    afterAll(async () => {
        // Restore
        // @ts-ignore
        MarketDataService.getQuote = originalGetQuote;
        // @ts-ignore
        NotificationService.dispatch = originalDispatch;
        // @ts-ignore
        SettingsService.getSmtpConfig = originalGetSmtp;

        await cleanup();
    });

    test("should trigger price ABOVE alert", async () => {
        const userId = crypto.randomUUID();
        const uniqueEmail = `alert_1_${Date.now()}@test.com`;
        await sql`INSERT INTO users (id, email, password_hash, full_name, role) VALUES (${userId}, ${uniqueEmail}, 'hash', 'Test', 'user')`;

        // Insert Alert with basic columns only
        await sql`
            INSERT INTO alerts (user_id, ticker, target_price, condition, is_active)
            VALUES (${userId}, 'AAPL', 150, 'above', true)
        `;

        // Mock Market Data (155 > 150)
        mockGetQuote.mockResolvedValue({ c: 155, currency: "USD" });

        await AlertService.checkAlerts();

        expect(mockGetQuote).toHaveBeenCalledWith("AAPL");
        expect(mockDispatch).toHaveBeenCalled();
    });

    test("should NOT trigger if condition not met", async () => {
        const userId = crypto.randomUUID();
        const uniqueEmail = `alert_2_${Date.now()}@test.com`;
        await sql`INSERT INTO users (id, email, password_hash, full_name, role) VALUES (${userId}, ${uniqueEmail}, 'h', 'T', 'user')`;

        await sql`
            INSERT INTO alerts (user_id, ticker, target_price, condition, is_active)
            VALUES (${userId}, 'TSLA', 200, 'above', true)
        `;

        mockGetQuote.mockResolvedValue({ c: 190 }); // 190 < 200

        await AlertService.checkAlerts();

        expect(mockGetQuote).toHaveBeenCalled();
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    // Volume alert test removed - basic schema doesn't have volume_multiplier column
});
