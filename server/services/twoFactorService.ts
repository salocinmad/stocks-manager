/**
 * Two-Factor Authentication Service
 * Handles TOTP generation, verification, QR codes, and backup codes
 */

import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import sql from '../db';
import crypto from 'crypto';

const APP_NAME = 'StocksManager';

export const TwoFactorService = {
    /**
     * Generate a new TOTP secret for a user
     */
    generateSecret(email: string): { secret: string; uri: string } {
        const totp = new OTPAuth.TOTP({
            issuer: APP_NAME,
            label: email,
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
            secret: OTPAuth.Secret.fromBase32(this.generateRandomBase32(20))
        });

        return {
            secret: totp.secret.base32,
            uri: totp.toString()
        };
    },

    /**
     * Generate random base32 string for TOTP secret
     */
    generateRandomBase32(length: number): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let result = '';
        const randomBytes = crypto.randomBytes(length);
        for (let i = 0; i < length; i++) {
            result += chars[randomBytes[i] % chars.length];
        }
        return result;
    },

    /**
     * Generate QR code as data URL
     */
    async generateQRCode(uri: string): Promise<string> {
        return await QRCode.toDataURL(uri, {
            width: 256,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
    },

    /**
     * Verify a TOTP code
     */
    verifyCode(secret: string, code: string): boolean {
        const totp = new OTPAuth.TOTP({
            issuer: APP_NAME,
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
            secret: OTPAuth.Secret.fromBase32(secret)
        });

        // Allow 1 period before/after for clock drift
        const delta = totp.validate({ token: code, window: 1 });
        return delta !== null;
    },

    /**
     * Generate 10 backup codes (8 characters each)
     */
    generateBackupCodes(): string[] {
        const codes: string[] = [];
        for (let i = 0; i < 10; i++) {
            // Generate 8-character alphanumeric code
            const code = crypto.randomBytes(4).toString('hex').toUpperCase();
            codes.push(code);
        }
        return codes;
    },

    /**
     * Hash backup codes for storage
     */
    hashBackupCodes(codes: string[]): string[] {
        return codes.map(code =>
            crypto.createHash('sha256').update(code).digest('hex')
        );
    },

    /**
     * Verify a backup code (returns true and removes from DB if valid)
     */
    async verifyBackupCode(userId: string, code: string): Promise<boolean> {
        const hashedInput = crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');

        // Get current backup codes
        const [user] = await sql`
            SELECT backup_codes FROM users WHERE id = ${userId}
        `;

        if (!user || !user.backup_codes || user.backup_codes.length === 0) {
            return false;
        }

        const index = user.backup_codes.indexOf(hashedInput);
        if (index === -1) {
            return false;
        }

        // Remove used code
        const updatedCodes = [...user.backup_codes];
        updatedCodes.splice(index, 1);

        await sql`
            UPDATE users 
            SET backup_codes = ${updatedCodes}
            WHERE id = ${userId}
        `;

        return true;
    },

    /**
     * Generate random email verification code (6 digits)
     */
    generateEmailCode(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    },

    /**
     * Save pending 2FA setup (before user confirms)
     */
    async savePendingSetup(userId: string, secret: string): Promise<void> {
        await sql`
            UPDATE users 
            SET two_factor_secret = ${secret}
            WHERE id = ${userId}
        `;
    },

    /**
     * Complete 2FA activation (after user downloads codes and verifies TOTP)
     */
    async activateTwoFactor(userId: string, backupCodes: string[]): Promise<void> {
        const hashedCodes = this.hashBackupCodes(backupCodes);

        await sql`
            UPDATE users 
            SET two_factor_enabled = TRUE,
                backup_codes = ${hashedCodes},
                backup_codes_downloaded = TRUE,
                backup_codes_generated_at = NOW()
            WHERE id = ${userId}
        `;
    },

    /**
     * Disable 2FA for a user
     */
    async disableTwoFactor(userId: string): Promise<void> {
        await sql`
            UPDATE users 
            SET two_factor_enabled = FALSE,
                two_factor_secret = NULL,
                security_mode = 'standard',
                backup_codes = NULL,
                backup_codes_downloaded = FALSE,
                backup_codes_generated_at = NULL
            WHERE id = ${userId}
        `;
    },

    /**
     * Update security mode
     */
    async setSecurityMode(userId: string, mode: 'standard' | 'enhanced'): Promise<void> {
        await sql`
            UPDATE users 
            SET security_mode = ${mode}
            WHERE id = ${userId}
        `;
    },

    /**
     * Get 2FA status for a user
     */
    async getStatus(userId: string): Promise<{
        enabled: boolean;
        securityMode: string;
        hasBackupCodes: boolean;
        backupCodesCount: number;
    }> {
        const [user] = await sql`
            SELECT two_factor_enabled, security_mode, backup_codes 
            FROM users WHERE id = ${userId}
        `;

        if (!user) {
            throw new Error('User not found');
        }

        return {
            enabled: user.two_factor_enabled || false,
            securityMode: user.security_mode || 'standard',
            hasBackupCodes: user.backup_codes && user.backup_codes.length > 0,
            backupCodesCount: user.backup_codes ? user.backup_codes.length : 0
        };
    },

    /**
     * Regenerate backup codes (invalidates old ones)
     */
    async regenerateBackupCodes(userId: string): Promise<string[]> {
        const newCodes = this.generateBackupCodes();
        const hashedCodes = this.hashBackupCodes(newCodes);

        await sql`
            UPDATE users 
            SET backup_codes = ${hashedCodes},
                backup_codes_downloaded = FALSE,
                backup_codes_generated_at = NOW()
            WHERE id = ${userId}
        `;

        return newCodes;
    },

    /**
     * Mark backup codes as downloaded (one-time view)
     */
    async markCodesDownloaded(userId: string): Promise<void> {
        await sql`
            UPDATE users 
            SET backup_codes_downloaded = TRUE
            WHERE id = ${userId}
        `;
    }
};
