import { describe, expect, test, mock, beforeEach, afterAll } from "bun:test";
import { TwoFactorService } from "../services/twoFactorService";
import * as OTPAuth from 'otpauth';
import sql from '../db';

describe("TwoFactorService (Integration)", () => {

    // Cleanup helper
    const cleanup = async () => {
        // Safe cleanup targeting only the test user
        await sql`DELETE FROM users WHERE email = 'auth_test@example.com'`;
    };

    beforeEach(async () => {
        await cleanup();
        // Also cleanup generic test emails just in case
        await sql`DELETE FROM users WHERE email LIKE 'test%@example.com'`;
    });

    afterAll(async () => {
        await cleanup();
    });

    test("should generate valid secret and URI", () => {
        const email = "test@example.com";
        const result = TwoFactorService.generateSecret(email);

        expect(result.uri).toContain("otpauth://totp/");
        expect(result.uri).toContain(encodeURIComponent(email));
        expect(result.uri).toContain("StocksManager");
    });

    test("should verify a valid TOTP code", () => {
        const email = "test@example.com";
        const { secret } = TwoFactorService.generateSecret(email);

        const totp = new OTPAuth.TOTP({
            secret: OTPAuth.Secret.fromBase32(secret),
            algorithm: 'SHA1',
            digits: 6,
            period: 30
        });
        const code = totp.generate();

        const isValid = TwoFactorService.verifyCode(secret, code);
        expect(isValid).toBe(true);
    });

    test("should reject an invalid TOTP code", () => {
        const { secret } = TwoFactorService.generateSecret("user@test.com");
        const isValid = TwoFactorService.verifyCode(secret, "000000");
        expect(isValid).toBe(false);
    });

    test("should generate 10 backup codes", () => {
        const codes = TwoFactorService.generateBackupCodes();
        expect(codes.length).toBe(10);
        expect(codes[0].length).toBe(8);
    });

    test("should verify backup code correctly", async () => {
        // Create real user for this test
        const email = 'auth_test@example.com';
        const [user] = await sql`
            INSERT INTO users (email, password_hash, full_name, role)
            VALUES (${email}, 'hash', 'Test User', 'user')
            RETURNING id
        `;
        const userId = user.id;

        const code = "ABCDEF12";
        const hashedCodes = TwoFactorService.hashBackupCodes([code]);

        // Update user with codes
        await sql`UPDATE users SET backup_codes = ${hashedCodes} WHERE id = ${userId}`;

        const isValid = await TwoFactorService.verifyBackupCode(userId, code);

        expect(isValid).toBe(true);

        // Verify code was removed from DB
        const [updatedUser] = await sql`SELECT backup_codes FROM users WHERE id = ${userId}`;
        expect(updatedUser.backup_codes.length).toBe(0);

        // Cleanup
        await cleanup();
    });
});
