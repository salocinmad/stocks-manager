
import sql from '../db';
import { SettingsService } from './settingsService';
import nodemailer from 'nodemailer';

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

    sendEmail: async (to: string, subject: string, html: string) => {
        try {
            const smtpConfig = await SettingsService.getSmtpConfig();
            if (!smtpConfig) {
                console.warn('[Notification] SMTP not configured, cannot send email.');
                return;
            }

            const transporter = nodemailer.createTransport({
                host: smtpConfig.host,
                port: Number(smtpConfig.port) || 587,
                secure: Number(smtpConfig.port) === 465, // true for 465, false for other ports
                auth: {
                    user: smtpConfig.user,
                    pass: smtpConfig.password, // Correct property
                },
            });

            await transporter.sendMail({
                from: `Stocks Manager <${smtpConfig.from || smtpConfig.user}>`,
                to,
                subject,
                html,
            });
            // console.log(`[Notification] Email sent to ${to}`);
        } catch (e: any) {
            console.error('Failed to send Email:', e.message);
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

            // 2. Formatting
            const telegramMsg = `<b>${title}</b>\n\n${message}`;
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
    },

    /**
     * Sends a critical system alert to the Administrator (Configured SMTP User).
     */
    notifyAdmin: async (title: string, message: string) => {
        try {
            const smtpConfig = await SettingsService.getSmtpConfig();
            if (!smtpConfig) return; // Silent fail if no email setup

            const adminEmail = smtpConfig.user; // Default to sender

            const html = `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e74c3c; border-radius: 5px;">
                    <h2 style="color: #e74c3c; margin-top: 0;">🚨 ${title}</h2>
                    <p style="font-size: 16px;">${message.replace(/\n/g, '<br>')}</p>
                    <hr>
                    <p style="font-size: 12px; color: #666;">Stocks Manager System Alert</p>
                    <a href="${process.env.APP_URL || '#'}" style="background: #333; color: #fff; padding: 10px 15px; text-decoration: none; border-radius: 4px;">Ir al Panel</a>
                </div>
            `;

            await NotificationService.sendEmail(adminEmail, `🚨 ALERTA CRÍTICA: ${title}`, html);
            console.log('[NotificationService] Admin Alert Email Sent.');
        } catch (e) {
            console.error('Failed to notify admin:', e);
        }
    }
};
