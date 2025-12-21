import nodemailer from 'nodemailer';
import sql from '../db';
import { MarketDataService, QuoteResult } from './marketData';
import { SettingsService } from './settingsService';
import { NotificationService } from './notificationService';

export const AlertService = {
    // Check all active alerts
    checkAlerts: async () => {
        console.log('Running Alert Service check...');

        // 1. Fetch active alerts that haven't been triggered recently? 
        // For simple logic: fetch all active alerts where triggered = false
        const alerts = await sql`
            SELECT a.*, u.email 
            FROM alerts a
            JOIN users u ON a.user_id = u.id
            WHERE a.is_active = true 
            AND a.triggered = false
        `;

        if (alerts.length > 0) {
            console.log(`Checking ${alerts.length} active alerts...`);
        } else {
            // Silencioso si no hay alertas para no ensuciar logs
            return;
        }

        // Group by ticker to optimize API calls
        const distinctTickers = [...new Set(alerts.map(a => a.ticker))];
        const quotes: Record<string, QuoteResult> = {};

        for (const ticker of distinctTickers) {
            try {
                const quote = await MarketDataService.getQuote(ticker);
                if (quote) {
                    quotes[ticker] = quote;
                }
            } catch (e) {
                console.error(`Failed to get price for ${ticker}`, e);
            }
        }

        // Check conditions
        for (const alert of alerts) {
            const quote = quotes[alert.ticker];
            if (!quote) continue;

            const currentPrice = quote.c;
            let conditionMet = false;
            const target = parseFloat(alert.target_price);

            const cond = alert.condition.toLowerCase();

            if (cond === 'above' && currentPrice >= target) {
                conditionMet = true;
            } else if (cond === 'below' && currentPrice <= target) {
                conditionMet = true;
            }

            if (conditionMet) {
                console.log(`Alert triggered for ${alert.ticker}: Current ${currentPrice} ${cond} ${target}`);

                const currency = quote.currency || 'EUR';
                const companyName = quote.name || alert.ticker;

                // 1. Send Email (Check if disabled by user)
                const emailConfig = await sql`
                    SELECT is_active FROM notification_channels 
                    WHERE user_id = ${alert.user_id} AND channel_type = 'email'
                `;

                const emailActive = emailConfig.length === 0 || emailConfig[0].is_active;

                if (emailActive) {
                    await AlertService.sendAlertEmail(alert.email, alert, currentPrice);
                }

                // 2. Send Notifications (Telegram, Discord, Teams)
                const title = `🔔 Alerta: ${companyName}`;
                const conditionText = cond === 'above' ? 'superado' : 'caído por debajo de';
                const msg = `El precio de ${alert.ticker} ha ${conditionText} ${target} ${currency}.\n\nPrecio Actual: ${currentPrice.toFixed(2)} ${currency}`;

                await NotificationService.dispatch(alert.user_id, title, msg);

                // Mark as triggered and update last check
                await sql`
                    UPDATE alerts 
                    SET triggered = true, is_active = false, last_checked_at = NOW() 
                    WHERE id = ${alert.id}
                `;
            } else {
                await sql`UPDATE alerts SET last_checked_at = NOW() WHERE id = ${alert.id}`;
            }
        }
    },

    sendAlertEmail: async (to: string, alert: any, currentPrice: number) => {
        const smtpConfig = await SettingsService.getSmtpConfig();

        if (!smtpConfig.host || !smtpConfig.user) {
            console.warn('SMTP settings not configured. Cannot send alert email.');
            return;
        }

        const transporter = nodemailer.createTransport({
            host: smtpConfig.host,
            port: parseInt(smtpConfig.port),
            secure: parseInt(smtpConfig.port) === 465,
            auth: {
                user: smtpConfig.user,
                pass: smtpConfig.password
            }
        });

        const cond = alert.condition.toLowerCase();
        const conditionText = cond === 'above' ? 'superado' : 'caído por debajo de';

        const mailOptions = {
            from: smtpConfig.from || smtpConfig.user,
            to: to,
            subject: `🔔 Alerta Stocks Manager: ${alert.ticker}`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 10px; padding: 20px;">
                    <h2 style="color: #2563eb;">Stocks Manager Alerta</h2>
                    <p>Hola,</p>
                    <p>Tu alerta para <strong>${alert.ticker}</strong> ha saltado.</p>
                    
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Condición Configurada:</strong> Precio ${conditionText} ${parseFloat(alert.target_price).toFixed(2)}</p>
                        <p style="margin: 5px 0; font-size: 1.2em;"><strong>Precio Actual de Mercado:</strong> <span style="color: ${alert.condition === 'above' ? 'green' : 'red'}; font-weight: bold;">${currentPrice.toFixed(2)}</span></p>
                    </div>

                    <p>La alerta ha sido desactivada automáticamente para evitar notificaciones repetitivas.</p>
                    <p>Puedes volver a activarla o crear una nueva en el panel de control.</p>
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 0.8em; color: #888;">Este es un mensaje automático de Stocks Manager.</p>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`Email sent to ${to} for ${alert.ticker}`);
        } catch (error) {
            console.error('Error sending alert email:', error);
        }
    }
};
