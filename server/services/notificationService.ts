import sql from '../db';
import { SettingsService } from './settingsService';

interface NotificationConfig {
    webhookUrl?: string; // For Discord, Teams
    botToken?: string;   // For Telegram
    chatId?: string;     // For Telegram
}

export const NotificationService = {
    // --- Low Level Senders ---

    sendTelegram: async (token: string, chatId: string, message: string) => {
        try {
            const url = `https://api.telegram.org/bot${token}/sendMessage`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: message,
                    parse_mode: 'HTML'
                })
            });
            if (!res.ok) console.error('Telegram API Error:', await res.text());
        } catch (e) {
            console.error('Failed to send Telegram message:', e);
        }
    },

    sendDiscord: async (webhookUrl: string, message: string) => {
        try {
            const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: message })
            });
            if (!res.ok) console.error('Discord API Error:', await res.text());
        } catch (e) {
            console.error('Failed to send Discord message:', e);
        }
    },

    sendTeams: async (webhookUrl: string, title: string, message: string) => {
        try {
            // Determine color based on content keywords
            let themeColor = "0076D7"; // Default Blue
            if (message.toLowerCase().includes('superado') || message.toLowerCase().includes('subida')) {
                themeColor = "28a745"; // Green (Success/Up)
            } else if (message.toLowerCase().includes('caído') || message.toLowerCase().includes('bajada') || message.toLowerCase().includes('below')) {
                themeColor = "dc3545"; // Red (Danger/Down)
            }

            const teamsMessage = {
                "@type": "MessageCard",
                "@context": "http://schema.org/extensions",
                "themeColor": themeColor,
                "summary": title,
                "sections": [{
                    "activityTitle": `**${title}**`,
                    "activitySubtitle": "Stocks Manager Alert",
                    "activityImage": "https://img.icons8.com/color/48/bullish.png", // Icono genérico de finanzas
                    "markdown": true,
                    "text": message, // Body directly in text looks better usually
                    "facts": [
                        {
                            "name": "Estado",
                            "value": themeColor === "28a745" ? "Target Alcanzado (Alcista) 🚀" :
                                themeColor === "dc3545" ? "Target Alcanzado (Bajista) 🔻" : "Información ℹ️"
                        }
                    ]
                }],
                "potentialAction": [{
                    "@type": "OpenUri",
                    "name": "Ver en Stocks Manager",
                    "targets": [{ "os": "default", "uri": process.env.APP_URL || "https://stocks.salodev.ovh" }]
                }]
            };

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(teamsMessage),
            });

            if (!response.ok) {
                throw new Error(`Teams API error: ${response.status} ${response.statusText}`);
            }
        } catch (e) {
            console.error('Failed to send Teams message:', e);
        }
    },

    // --- High Level Dispatcher ---

    /**
     * Dispatch a notification to all active channels configured by the user.
     */
    dispatch: async (userId: string, title: string, message: string) => {
        try {
            // 1. Fetch active channels
            const channels = await sql`
                SELECT channel_type, config 
                FROM notification_channels 
                WHERE user_id = ${userId} 
                AND is_active = true
            `;

            if (channels.length === 0) return;

            console.log(`Dispatching notification for users ${userId} via ${channels.length} channels.`);

            // 2. Formatting
            // Telegram supports basic HTML. Discord Markdown. Teams HTML-ish.
            // We use simple formatted string for now.

            // Telegram Message (supports HTML)
            const telegramMsg = `<b>${title}</b>\n\n${message}`;

            // Discord Message (Markdown)
            const discordMsg = `**${title}**\n${message}`;

            // 3. Send in parallel
            for (const ch of channels) {
                // Decrypt config
                const rawConfig = ch.config as any;
                const config: NotificationConfig = {};

                if (rawConfig.webhookUrl) config.webhookUrl = SettingsService.decrypt(rawConfig.webhookUrl);
                if (rawConfig.botToken) config.botToken = SettingsService.decrypt(rawConfig.botToken);
                if (rawConfig.chatId) config.chatId = SettingsService.decrypt(rawConfig.chatId);

                // If decryption returned empty string (failed), skip
                if ((ch.channel_type !== 'telegram' && !config.webhookUrl) ||
                    (ch.channel_type === 'telegram' && (!config.botToken || !config.chatId))) {
                    console.warn(`Skipping ${ch.channel_type} for user ${userId} due to decryption failure or missing config.`);
                    continue;
                }

                if (ch.channel_type === 'telegram' && config.botToken && config.chatId) {
                    NotificationService.sendTelegram(config.botToken, config.chatId, telegramMsg);
                }
                else if (ch.channel_type === 'discord' && config.webhookUrl) {
                    NotificationService.sendDiscord(config.webhookUrl, discordMsg);
                }
                else if (ch.channel_type === 'teams' && config.webhookUrl) {
                    NotificationService.sendTeams(config.webhookUrl, title, message);
                }
            }

        } catch (error) {
            console.error('Error dispatching notifications:', error);
        }
    }
};
