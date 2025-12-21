import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import sql from '../db';
import { SettingsService } from '../services/settingsService';
import { NotificationService } from '../services/notificationService';
import { AlertService } from '../services/alertService';

export const notificationRoutes = new Elysia({ prefix: '/notifications' })
    .use(
        jwt({
            name: 'jwt',
            secret: process.env.JWT_SECRET || 'changeme_in_prod',
        })
    )
    .derive(async ({ jwt, headers, set }) => {
        const auth = headers['authorization'];
        if (!auth?.startsWith('Bearer ')) {
            set.status = 401;
            throw new Error('Unauthorized');
        }
        const token = auth.slice(7);
        const profile = await jwt.verify(token) as { sub?: string } | false;
        if (!profile || !profile.sub) throw new Error('Unauthorized');
        return { userId: profile.sub };
    })

    // Get Channels
    .get('/channels', async ({ userId }) => {
        const channels = await sql`
            SELECT id, channel_type, is_active, created_at, config
            FROM notification_channels 
            WHERE user_id = ${userId}
        `;

        return channels.map(ch => {
            const rawConfig = ch.config as any;
            const config: any = {};
            if (rawConfig.webhookUrl) config.webhookUrl = SettingsService.decrypt(rawConfig.webhookUrl);

            // Mask highly sensitive tokens, usually user just overwrites them
            if (rawConfig.botToken) config.botToken = '••••••••';

            if (rawConfig.chatId) config.chatId = SettingsService.decrypt(rawConfig.chatId);

            return {
                id: ch.id,
                channel_type: ch.channel_type,
                is_active: ch.is_active,
                config
            };
        });
    })

    // Test Channel
    .post('/test', async ({ userId, body }) => {
        const { channel_type, config } = body as { channel_type: string, config: any };

        let finalConfig = { ...config };

        // If getting masked token, fetch from DB
        if (config.botToken === '••••••••') {
            const existing = await sql`SELECT config FROM notification_channels WHERE user_id=${userId} AND channel_type=${channel_type}`;
            if (existing.length > 0) {
                const dbConfigRaw = existing[0].config;
                if (dbConfigRaw.botToken) finalConfig.botToken = SettingsService.decrypt(dbConfigRaw.botToken);
                // If chatID is missing or masked (though only token is strictly masked usually)
                if (!finalConfig.chatId && dbConfigRaw.chatId) finalConfig.chatId = SettingsService.decrypt(dbConfigRaw.chatId);
            }
        }

        const testMsg = "✅ Stocks Manager: Prueba de notificación exitosa.";

        try {
            if (channel_type === 'telegram') {
                if (!finalConfig.botToken || !finalConfig.chatId) throw new Error('Missing Telegram credentials');
                await NotificationService.sendTelegram(finalConfig.botToken, finalConfig.chatId, testMsg);
            } else if (channel_type === 'discord') {
                if (!finalConfig.webhookUrl) throw new Error('Missing Webhook URL');
                await NotificationService.sendDiscord(finalConfig.webhookUrl, `**Prueba**\n${testMsg}`);
            } else if (channel_type === 'teams') {
                if (!finalConfig.webhookUrl) throw new Error('Missing Webhook URL');
                await NotificationService.sendTeams(finalConfig.webhookUrl, "Prueba Stocks Manager", testMsg);
            } else if (channel_type === 'email') {
                const users = await sql`SELECT email FROM users WHERE id=${userId}`;
                if (users.length === 0) throw new Error('User email not found');
                await AlertService.sendAlertEmail(users[0].email, { ticker: 'TEST', condition: 'above', target_price: '100' }, 120);
            }
            return { success: true };
        } catch (e) {
            console.error(e);
            throw new Error('Test failed: ' + (e as Error).message);
        }
    })

    // Save Channel Config (Encrypts everything)
    .post('/channels', async ({ userId, body }) => {
        const { channel_type, config } = body as { channel_type: string, config: any };

        if (!['telegram', 'discord', 'teams', 'webhook'].includes(channel_type)) {
            throw new Error('Invalid channel type');
        }

        // Encrypt sensitive fields
        const encryptedConfig: any = {};
        // Only encrypt what is present
        if (config.webhookUrl) encryptedConfig.webhookUrl = SettingsService.encrypt(config.webhookUrl);
        if (config.botToken && config.botToken !== '••••••••') {
            // Only update token if it's not the mask
            encryptedConfig.botToken = SettingsService.encrypt(config.botToken);
        } else if (config.botToken === '••••••••') {
            // Keep existing token logic is tricky in INSERT ON CONFLICT DO UPDATE...
            // Best strategy: Fetch existing config if token is masked, or handle in frontend sending null?
            // Simplest: Frontend sends null if not changing.
            // If frontend sends mask, we ignore it? 
            // Let's assume frontend sends REAL value only when changing.
        }

        if (config.chatId) encryptedConfig.chatId = SettingsService.encrypt(config.chatId);

        // If updating an existing mask, we need to preserve old values.
        // It's cleaner to do this:
        // 1. Check if exists
        const existing = await sql`SELECT config FROM notification_channels WHERE user_id=${userId} AND channel_type=${channel_type}`;

        let finalConfig = encryptedConfig;
        if (existing.length > 0) {
            const oldConfig = existing[0].config;
            // Merge: New takes precedence, unless it's missing/masked
            if (!finalConfig.botToken && oldConfig.botToken) finalConfig.botToken = oldConfig.botToken;
            if (!finalConfig.webhookUrl && oldConfig.webhookUrl) finalConfig.webhookUrl = oldConfig.webhookUrl;
            if (!finalConfig.chatId && oldConfig.chatId) finalConfig.chatId = oldConfig.chatId;
        }

        await sql`
            INSERT INTO notification_channels (user_id, channel_type, config, is_active)
            VALUES (${userId}, ${channel_type}, ${finalConfig}, true)
            ON CONFLICT (user_id, channel_type) 
            DO UPDATE SET 
                config = ${finalConfig},
                is_active = true,
                created_at = NOW()
        `;

        return { success: true };
    })

    // Toggle Active
    .put('/channels/:type/toggle', async ({ userId, params }) => {
        await sql`
            UPDATE notification_channels
            SET is_active = NOT is_active
            WHERE user_id = ${userId} AND channel_type = ${params.type}
        `;
        return { success: true };
    })

    // Delete
    .delete('/channels/:type', async ({ userId, params }) => {
        await sql`
            DELETE FROM notification_channels
            WHERE user_id = ${userId} AND channel_type = ${params.type}
        `;
        return { success: true };
    });
