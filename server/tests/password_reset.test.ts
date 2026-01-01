import { describe, expect, it, beforeAll, afterAll, mock } from 'bun:test';
import { setupTestEnv, teardownTestEnv } from './setup';
import sql from '../db';
import { authRoutes } from '../routes/auth';
import { EmailService } from '../services/emailService';

describe('Password Reset Flow', () => {
    let testUser: any;

    // Mock Email Service to avoid timeouts
    const originalSendEmail = EmailService.sendEmail;

    beforeAll(async () => {
        // @ts-ignore
        EmailService.sendEmail = mock(() => Promise.resolve(true));

        // 1. Clean DB first (Global cleanup)
        await setupTestEnv();

        const email = 'reset_test@example.com';
        const passwordHash = '$2a$10$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'; // Dummy hash

        console.log('[Setup] Initializing test user:', email);

        try {
            // 2. Ensure clean slate for this user
            await sql`DELETE FROM users WHERE email = ${email}`;

            // 3. Insert test user (Split operation for robustness)
            await sql`
                INSERT INTO users (email, password_hash, full_name, role)
                VALUES (${email}, ${passwordHash}, 'Reset Tester', 'user')
            `;

            // 4. Fetch the user explicitly
            const users = await sql`SELECT * FROM users WHERE email = ${email}`;

            if (users && users.length > 0) {
                testUser = users[0];
                console.log('[Setup] User created successfully:', testUser.id);
            } else {
                console.error('[Setup] FATAL: INSERT appeared to succeed but SELECT found nothing.');
                const allUsers = await sql`SELECT id, email FROM users`;
                console.log('[Setup] Debug: All users in DB:', allUsers);
            }
        } catch (e: any) {
            console.error('[Setup] FATAL: Insert user error:', e);
        }
    });

    afterAll(async () => {
        // @ts-ignore
        EmailService.sendEmail = originalSendEmail;
        await teardownTestEnv();
    });

    it('should generate a token for valid email', async () => {
        const response = await authRoutes.handle(new Request('http://localhost/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testUser.email })
        }));

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toHaveProperty('success', true);

        // Verify token in DB
        const resets = await sql`SELECT * FROM password_resets WHERE user_id = ${testUser.id}`;
        expect(resets.length).toBe(1);
        expect(resets[0].used).toBe(false);
    });

    it('should NOT reveal if email does not exist', async () => {
        const response = await authRoutes.handle(new Request('http://localhost/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'nonexistent@example.com' })
        }));

        expect(response.status).toBe(200); // Should still return 200 Security best practice
        const data = await response.json();
        expect(data).toHaveProperty('success', true);
    });

    it('should reset password with valid token', async () => {
        // 1. Manually insert a known token hash for testing (simulating the hash logic from auth.ts)
        const rawToken = 'valid-token-123';
        const hash = new Bun.CryptoHasher("sha256").update(rawToken).digest("hex");
        const expiresAt = new Date(Date.now() + 3600000); // +1 hour

        await sql`
            INSERT INTO password_resets (user_id, token_hash, expires_at)
            VALUES (${testUser.id}, ${hash}, ${expiresAt.toISOString()})
        `;

        // 2. Call reset-password
        const newPassword = 'NewSecurePassword123!';
        const response = await authRoutes.handle(new Request('http://localhost/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: rawToken, newPassword })
        }));

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);

        // 3. Verify DB update
        const [updatedUser] = await sql`SELECT password_hash FROM users WHERE id = ${testUser.id}`;
        expect(updatedUser.password_hash).not.toBe(testUser.password_hash); // Hash should have changed

        // 4. Verify token marked as used
        const [usedToken] = await sql`SELECT used FROM password_resets WHERE token_hash = ${hash}`;
        expect(usedToken.used).toBe(true);
    });

    it('should reject invalid token', async () => {
        const response = await authRoutes.handle(new Request('http://localhost/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: 'invalid-token', newPassword: 'pwd' })
        }));

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('inválido');
    });

    it('should reject expired token', async () => {
        // 1. Insert expired token
        const rawToken = 'expired-token';
        const hash = new Bun.CryptoHasher("sha256").update(rawToken).digest("hex");
        const expiresAt = new Date(Date.now() - 3600000); // -1 hour (expired)

        await sql`
            INSERT INTO password_resets (user_id, token_hash, expires_at)
            VALUES (${testUser.id}, ${hash}, ${expiresAt.toISOString()})
        `;

        // 2. Try to reset
        const response = await authRoutes.handle(new Request('http://localhost/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: rawToken, newPassword: 'pwd' })
        }));

        expect(response.status).toBe(400);
    });
});
