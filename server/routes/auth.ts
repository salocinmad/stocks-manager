import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import sql from '../db';
import bcrypt from 'bcryptjs';
import { TwoFactorService } from '../services/twoFactorService';
import { EmailService } from '../services/emailService';

// Store temporary 2FA sessions (in production, use Redis)
const pending2FASessions = new Map<string, { userId: string; email: string; role: string; name: string; currency: string; securityMode: string; rememberMe?: boolean; emailCode?: string; expiresAt: number }>();

// Duración del token: 2 horas en segundos
const TOKEN_EXPIRATION = 2 * 60 * 60;

export const authRoutes = new Elysia({ prefix: '/auth' })
    .use(
        jwt({
            name: 'jwt',
            secret: process.env.JWT_SECRET || 'changeme_in_prod'
            // No default exp - we'll set it dynamically per token
        })
    )
    .post('/register', async ({ body, set, jwt }) => {
        // @ts-ignore
        const { email, password, fullName } = body;

        const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
        if (existing.length > 0) {
            set.status = 400;
            return { error: 'User already exists' };
        }

        const userCount = await sql`SELECT COUNT(*) as count FROM users`;
        const isFirstUser = parseInt(userCount[0].count) === 0;
        const role = isFirstUser ? 'admin' : 'user';

        const hashedPassword = await bcrypt.hash(password, 10);

        try {
            const [user] = await sql`
                INSERT INTO users (email, password_hash, full_name, role)
                VALUES (${email}, ${hashedPassword}, ${fullName}, ${role})
                RETURNING id, email, full_name, role, avatar_url
            `;

            await sql`
                INSERT INTO portfolios (user_id, name, is_public)
                VALUES (${user.id}, 'Portafolio Principal', false)
            `;

            const token = await jwt.sign({
                sub: user.id,
                email: user.email,
                role: user.role
            });

            return {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.full_name,
                    role: user.role,
                    avatar_url: user.avatar_url
                }
            };
        } catch (error: any) {
            console.error('Registration error:', error);
            set.status = 500;
            return { error: 'Error creating account: ' + error.message };
        }
    }, {
        body: t.Object({
            email: t.String(),
            password: t.String(),
            fullName: t.String()
        })
    })
    .post('/login', async ({ body, set, jwt }) => {
        // @ts-ignore
        const { email, password, totpCode, backupCode, sessionToken, rememberMe } = body;

        // Token expiration based on rememberMe
        const tokenExp = rememberMe ? '7d' : '2h';

        // Step 2: 2FA verification
        if (sessionToken) {
            const session = pending2FASessions.get(sessionToken);
            if (!session || session.expiresAt < Date.now()) {
                pending2FASessions.delete(sessionToken);
                set.status = 401;
                return { error: 'Sesión 2FA expirada. Vuelve a iniciar sesión.' };
            }

            const [user] = await sql`SELECT * FROM users WHERE id = ${session.userId}`;
            if (!user) {
                set.status = 401;
                return { error: 'Usuario no encontrado' };
            }

            // Validate TOTP or backup code
            if (backupCode) {
                const valid = await TwoFactorService.verifyBackupCode(user.id, backupCode);
                if (!valid) {
                    set.status = 401;
                    return { error: 'Código de respaldo inválido' };
                }
            } else if (totpCode) {
                const valid = TwoFactorService.verifyCode(user.two_factor_secret, totpCode);
                if (!valid) {
                    set.status = 401;
                    return { error: 'Código 2FA incorrecto' };
                }
            } else {
                set.status = 400;
                return { error: 'Se requiere código 2FA o código de respaldo' };
            }

            pending2FASessions.delete(sessionToken);

            const token = await jwt.sign({
                sub: user.id,
                email: user.email,
                role: user.role || 'user',
                exp: Math.floor(Date.now() / 1000) + (session.rememberMe ? 7 * 24 * 60 * 60 : 2 * 60 * 60)
            });

            return {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.full_name,
                    currency: user.preferred_currency,
                    role: user.role || 'user',
                    avatar_url: user.avatar_url
                }
            };
        }

        // Step 1: Validate email/password
        const users = await sql`SELECT * FROM users WHERE email = ${email}`;
        if (users.length === 0) {
            set.status = 401;
            return { error: 'Invalid credentials' };
        }

        const user = users[0];

        if (user.is_blocked) {
            set.status = 403;
            return { error: 'Tu cuenta ha sido bloqueada.' };
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            set.status = 401;
            return { error: 'Invalid credentials' };
        }

        // Check if 2FA is enabled
        if (user.two_factor_enabled) {
            const sessionToken = crypto.randomUUID();
            const sessionData: any = {
                userId: user.id,
                email: user.email,
                role: user.role || 'user',
                name: user.full_name,
                currency: user.preferred_currency,
                securityMode: user.security_mode || 'standard',
                rememberMe: !!rememberMe,
                expiresAt: Date.now() + 5 * 60 * 1000
            };

            if (user.security_mode === 'enhanced') {
                const emailCode = TwoFactorService.generateEmailCode();
                sessionData.emailCode = emailCode;

                await EmailService.sendEmail(
                    user.email,
                    'Código de verificación - Stocks Manager',
                    `<p>Tu código de verificación es: <strong>${emailCode}</strong></p><p>Válido por 5 minutos.</p>`
                );
            }

            pending2FASessions.set(sessionToken, sessionData);

            return {
                requires2FA: true,
                sessionToken,
                securityMode: user.security_mode || 'standard'
            };
        }

        const token = await jwt.sign({
            sub: user.id,
            email: user.email,
            role: user.role || 'user',
            exp: Math.floor(Date.now() / 1000) + (rememberMe ? 7 * 24 * 60 * 60 : 2 * 60 * 60)
        });

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.full_name,
                currency: user.preferred_currency,
                role: user.role || 'user'
            }
        };
    })
    .post('/forgot-password', async ({ body, set }) => {
        // @ts-ignore
        const { email } = body;

        const users = await sql`SELECT id, full_name FROM users WHERE email = ${email}`;

        if (users.length > 0) {
            const user = users[0];
            const newPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-4).toUpperCase();
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await sql`UPDATE users SET password_hash = ${hashedPassword} WHERE id = ${user.id}`;

            const emailHtml = `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Stocks Manager - Recuperación</h2>
                    <p>Tu nueva contraseña temporal es: <strong>${newPassword}</strong></p>
                    <p>Cámbiala lo antes posible.</p>
                </div>
            `;

            await EmailService.sendEmail(email, 'Nueva contraseña', emailHtml);
        }

        return { success: true, message: 'Si el correo existe, recibirás instrucciones.' };
    }, {
        body: t.Object({ email: t.String() })
    })
    .post('/change-password', async ({ headers, body, set, jwt }) => {
        const auth = headers['authorization'];
        if (!auth?.startsWith('Bearer ')) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }
        const profile = await jwt.verify(auth.slice(7)) as any;
        if (!profile?.sub) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const { currentPassword, newPassword } = body as any;
        const user = await sql`SELECT password_hash FROM users WHERE id = ${profile.sub}`;

        const valid = await bcrypt.compare(currentPassword, user[0].password_hash);
        if (!valid) {
            set.status = 400;
            return { error: 'Contraseña actual incorrecta' };
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        await sql`UPDATE users SET password_hash = ${hashed} WHERE id = ${profile.sub}`;

        return { success: true };
    })
    // ============ 2FA ENDPOINTS ============
    .get('/2fa/status', async ({ headers, set, jwt }) => {
        const auth = headers['authorization'];
        if (!auth?.startsWith('Bearer ')) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }
        const profile = await jwt.verify(auth.slice(7)) as any;
        if (!profile?.sub) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        return await TwoFactorService.getStatus(profile.sub);
    })
    .post('/2fa/setup', async ({ headers, set, jwt }) => {
        const auth = headers['authorization'];
        if (!auth?.startsWith('Bearer ')) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }
        const profile = await jwt.verify(auth.slice(7)) as any;
        if (!profile?.sub) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const [user] = await sql`SELECT email, two_factor_enabled FROM users WHERE id = ${profile.sub}`;
        if (user.two_factor_enabled) {
            set.status = 400;
            return { error: '2FA ya está activado' };
        }

        const { secret, uri } = TwoFactorService.generateSecret(user.email);
        const qrCode = await TwoFactorService.generateQRCode(uri);
        await TwoFactorService.savePendingSetup(profile.sub, secret);
        const backupCodes = TwoFactorService.generateBackupCodes();

        return { secret, qrCode, backupCodes };
    })
    .post('/2fa/verify', async ({ headers, body, set, jwt }) => {
        const auth = headers['authorization'];
        if (!auth?.startsWith('Bearer ')) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }
        const profile = await jwt.verify(auth.slice(7)) as any;
        if (!profile?.sub) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const { code, backupCodes } = body as any;

        const [user] = await sql`SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = ${profile.sub}`;

        if (!user.two_factor_secret) {
            set.status = 400;
            return { error: 'Primero inicia la configuración de 2FA' };
        }

        if (user.two_factor_enabled) {
            set.status = 400;
            return { error: '2FA ya está activado' };
        }

        if (!backupCodes || backupCodes.length !== 10) {
            set.status = 400;
            return { error: 'Debes descargar los códigos de respaldo primero' };
        }

        const valid = TwoFactorService.verifyCode(user.two_factor_secret, code);
        if (!valid) {
            set.status = 400;
            return { error: 'Código incorrecto' };
        }

        await TwoFactorService.activateTwoFactor(profile.sub, backupCodes);

        return { success: true, message: '2FA activado correctamente' };
    })
    .post('/2fa/disable', async ({ headers, body, set, jwt }) => {
        const auth = headers['authorization'];
        if (!auth?.startsWith('Bearer ')) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }
        const profile = await jwt.verify(auth.slice(7)) as any;
        if (!profile?.sub) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const { code, password } = body as any;

        const [user] = await sql`SELECT password_hash, two_factor_secret, two_factor_enabled FROM users WHERE id = ${profile.sub}`;

        if (!user.two_factor_enabled) {
            set.status = 400;
            return { error: '2FA no está activado' };
        }

        const validPwd = await bcrypt.compare(password, user.password_hash);
        if (!validPwd) {
            set.status = 400;
            return { error: 'Contraseña incorrecta' };
        }

        const valid = TwoFactorService.verifyCode(user.two_factor_secret, code);
        if (!valid) {
            set.status = 400;
            return { error: 'Código 2FA incorrecto' };
        }

        await TwoFactorService.disableTwoFactor(profile.sub);

        return { success: true };
    })
    .patch('/2fa/security-mode', async ({ headers, body, set, jwt }) => {
        const auth = headers['authorization'];
        if (!auth?.startsWith('Bearer ')) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }
        const profile = await jwt.verify(auth.slice(7)) as any;
        if (!profile?.sub) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const { mode } = body as any;
        if (mode !== 'standard' && mode !== 'enhanced') {
            set.status = 400;
            return { error: 'Modo inválido' };
        }

        const [user] = await sql`SELECT two_factor_enabled FROM users WHERE id = ${profile.sub}`;
        if (mode === 'enhanced' && !user.two_factor_enabled) {
            set.status = 400;
            return { error: 'Activa 2FA primero' };
        }

        await TwoFactorService.setSecurityMode(profile.sub, mode);

        return { success: true, mode };
    })
    .post('/2fa/regenerate-backup-codes', async ({ headers, body, set, jwt }) => {
        const auth = headers['authorization'];
        if (!auth?.startsWith('Bearer ')) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }
        const profile = await jwt.verify(auth.slice(7)) as any;
        if (!profile?.sub) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const { password } = body as any;

        const [user] = await sql`SELECT password_hash, two_factor_enabled FROM users WHERE id = ${profile.sub}`;

        if (!user.two_factor_enabled) {
            set.status = 400;
            return { error: '2FA no está activado' };
        }

        const validPwd = await bcrypt.compare(password, user.password_hash);
        if (!validPwd) {
            set.status = 400;
            return { error: 'Contraseña incorrecta' };
        }

        const newCodes = await TwoFactorService.regenerateBackupCodes(profile.sub);

        return { success: true, backupCodes: newCodes };
    });
