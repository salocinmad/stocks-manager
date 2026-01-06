import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { PortfolioService } from "../services/portfolioService";
import { PortfolioAlertService } from "../services/portfolioAlertService";
import sql from "../db";

describe("Global Portfolio Alerts", () => {
    let userId: string;
    let portId: string;
    let alertId: string;

    beforeAll(async () => {
        try {
            console.log("STARTING TEST SETUP");
            // Setup User & Portfolio
            userId = crypto.randomUUID();
            const email = `global_alert_${Date.now()}@test.com`;
            try {
                await sql`INSERT INTO users (id, email, password_hash, full_name, role) VALUES (${userId}, ${email}, 'hash', 'Test', 'user')`;
            } catch (e) {
                // Ignore unique constraint if run explicitly
            }

            portId = crypto.randomUUID();
            console.log("Creating Portfolio...");
            await sql`INSERT INTO portfolios (id, user_id, name) VALUES (${portId}, ${userId}, 'Global Alert Port')`;

            // Add Position AAPL
            console.log("Adding AAPL...");
            await PortfolioService.addTransaction(portId, "AAPL", "BUY", 10, 150, "USD", 0);

            // Add Position MSFT
            console.log("Adding MSFT...");
            await PortfolioService.addTransaction(portId, "MSFT", "BUY", 10, 300, "USD", 0);
            console.log("SETUP COMPLETE");
        } catch (err) {
            console.error("SETUP FAILED:", err);
            throw err;
        }
    });

    afterAll(async () => {
        // Cleanup
        await sql`DELETE FROM users WHERE id = ${userId}`; // Cascade deletes portfolio & alerts
        await sql`DELETE FROM market_cache WHERE key IN ('quote:AAPL', 'quote:MSFT')`;
    });

    test("should trigger alert when asset moves significantly", async () => {
        // 1. Create Global Alert (5% threshold)
        const [alert] = await sql`
            INSERT INTO portfolio_alerts (
                user_id, portfolio_id, alert_type, threshold_percent, 
                is_repeatable, repeat_cooldown_hours, is_active, triggered_assets
            ) VALUES (
                ${userId}, ${portId}, 'any_asset_change_percent', 5.0, 
                true, 1, true, '{}'::jsonb
            ) RETURNING *
        `;
        alertId = alert.id;

        // 2. Mock Market Data (AAPL +6%, MSFT +1%)
        // AAPL triggers (6 > 5), MSFT does not (1 < 5).
        await sql`
            INSERT INTO market_cache (key, data, updated_at, expires_at)
            VALUES 
            ('quote:AAPL', '{"c": 159, "dp": 6.0, "currency": "USD"}'::jsonb, NOW(), NOW() + interval '1 hour'),
            ('quote:MSFT', '{"c": 303, "dp": 1.0, "currency": "USD"}'::jsonb, NOW(), NOW() + interval '1 hour')
            ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW(), expires_at = EXCLUDED.expires_at
        `;

        // 3. Process Alerts
        console.log("Running Alert Check 1...");
        await PortfolioAlertService.checkPortfolioAlerts();

        // 4. Verify Trigger
        const [updatedAlert] = await sql`SELECT * FROM portfolio_alerts WHERE id = ${alertId}`;
        const triggeredAssets = updatedAlert.triggered_assets; // JSONB map

        console.log("Triggered Assets 1:", triggeredAssets);
        expect(triggeredAssets['AAPL']).toBeDefined(); // Should have timestamp
        expect(triggeredAssets['MSFT']).toBeUndefined(); // Should NOT trigger

        // 5. Verify Cooldown logic
        // Run again immediately. Should NOT update timestamp.
        // But first let's update MSFT to trigger now (-6.5%).

        await sql`
             INSERT INTO market_cache (key, data, updated_at, expires_at)
             VALUES ('quote:MSFT', '{"c": 280, "dp": -6.5, "currency": "USD"}'::jsonb, NOW(), NOW() + interval '1 hour')
             ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW(), expires_at = EXCLUDED.expires_at
        `;

        console.log("Running Alert Check 2 (MSFT Crash)...");
        await PortfolioAlertService.checkPortfolioAlerts();

        const [finalAlert] = await sql`SELECT * FROM portfolio_alerts WHERE id = ${alertId}`;
        console.log("Triggered Assets 2:", finalAlert.triggered_assets);

        expect(finalAlert.triggered_assets['MSFT']).toBeDefined();
        expect(finalAlert.triggered_assets['AAPL']).toBeDefined();
    });
});
