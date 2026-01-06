import nodemailer from 'nodemailer';
import sql from '../db';
import { MarketDataService, QuoteResult } from './marketData';
import { SettingsService } from './settingsService';
import { NotificationService } from './notificationService';

export const AlertService = {
    // Check all active alerts (supports price, percent_change, volume types)
    checkAlerts: async () => {


        // Fetch active alerts (include repeatable ones that may have been triggered before)
        const alerts = await sql`
            SELECT a.*, u.email 
            FROM alerts a
            JOIN users u ON a.user_id = u.id
            WHERE a.is_active = true 
            AND (
                a.triggered = false 
                OR (a.is_repeatable = true AND (
                    a.last_triggered_at IS NULL 
                    OR a.last_triggered_at < NOW() - (a.repeat_cooldown_hours || ' hours')::interval
                ))
            )
        `;

        if (alerts.length > 0) {

        } else {
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
            const alertType = alert.alert_type || 'price';
            let conditionMet = false;
            let notificationMessage = '';

            // Check based on alert type
            if (alertType === 'price') {
                const target = parseFloat(alert.target_price);
                const cond = (alert.condition || 'below').toLowerCase();

                if (cond === 'above' && currentPrice >= target) {
                    conditionMet = true;
                    notificationMessage = `El precio de ${alert.ticker} ha superado ${target} ${quote.currency || 'EUR'}.\n\nPrecio Actual: ${currentPrice.toFixed(2)}`;
                } else if (cond === 'below' && currentPrice <= target) {
                    conditionMet = true;
                    notificationMessage = `El precio de ${alert.ticker} ha caído por debajo de ${target} ${quote.currency || 'EUR'}.\n\nPrecio Actual: ${currentPrice.toFixed(2)}`;
                }
            } else if (alertType === 'percent_change') {
                const threshold = parseFloat(alert.percent_threshold) || 5;
                const changePercent = quote.dp || 0; // Daily percent change

                if (Math.abs(changePercent) >= threshold) {
                    conditionMet = true;
                    const direction = changePercent > 0 ? 'subido' : 'bajado';
                    notificationMessage = `${alert.ticker} ha ${direction} un ${Math.abs(changePercent).toFixed(2)}% hoy (umbral: ${threshold}%).\n\nPrecio: ${currentPrice.toFixed(2)}`;
                }
            } else if (alertType === 'volume') {
                const multiplier = parseFloat(alert.volume_multiplier) || 2;
                const currentVolume = quote.volume || 0;
                const avgVolume = quote.averageVolume || currentVolume;

                if (avgVolume > 0 && currentVolume >= avgVolume * multiplier) {
                    conditionMet = true;
                    const ratio = (currentVolume / avgVolume).toFixed(1);
                    notificationMessage = `Volumen inusual en ${alert.ticker}: ${ratio}x el promedio.\n\nVolumen: ${currentVolume.toLocaleString()}`;
                }
            } else if (alertType === 'rsi') {
                // RSI Alert: Check from cached analysis data
                try {
                    const cached = await sql`
                        SELECT rsi, calculated_at FROM position_analysis_cache 
                        WHERE ticker = ${alert.ticker}
                        ORDER BY calculated_at DESC LIMIT 1
                    `;

                    if (cached.length > 0 && cached[0].rsi) {
                        const rsi = Number(cached[0].rsi);
                        const rsiThreshold = alert.rsi_threshold || 70;
                        const rsiCondition = alert.rsi_condition || 'overbought';
                        const lastValue = Number(alert.last_indicator_value) || 0;

                        // Only trigger if RSI crosses the threshold (avoid repeated alerts)
                        if (rsiCondition === 'overbought' && rsi >= rsiThreshold && lastValue < rsiThreshold) {
                            conditionMet = true;
                            notificationMessage = `📈 RSI de ${alert.ticker} indica SOBRECOMPRA.\n\nRSI actual: ${rsi.toFixed(1)} (umbral: ${rsiThreshold})\nPrecio: ${currentPrice.toFixed(2)}`;
                        } else if (rsiCondition === 'oversold' && rsi <= rsiThreshold && lastValue > rsiThreshold) {
                            conditionMet = true;
                            notificationMessage = `📉 RSI de ${alert.ticker} indica SOBREVENTA.\n\nRSI actual: ${rsi.toFixed(1)} (umbral: ${rsiThreshold})\nPrecio: ${currentPrice.toFixed(2)}`;
                        }

                        // Update last indicator value
                        await sql`UPDATE alerts SET last_indicator_value = ${rsi} WHERE id = ${alert.id}`;
                    }
                } catch (e) {
                    console.error(`Error checking RSI alert for ${alert.ticker}:`, e);
                }
            } else if (alertType === 'sma_cross') {
                // SMA Cross Alert: Golden Cross (SMA50 > SMA200) or Death Cross (SMA50 < SMA200)
                try {
                    const cached = await sql`
                        SELECT sma_50, sma_200, calculated_at FROM position_analysis_cache 
                        WHERE ticker = ${alert.ticker}
                        ORDER BY calculated_at DESC LIMIT 1
                    `;

                    if (cached.length > 0 && cached[0].sma_50 && cached[0].sma_200) {
                        const sma50 = Number(cached[0].sma_50);
                        const sma200 = Number(cached[0].sma_200);
                        const smaType = alert.sma_type || 'golden_cross';
                        const lastValue = Number(alert.last_indicator_value) || 0;

                        // Calculate current ratio (positive = SMA50 above SMA200)
                        const currentRatio = sma50 - sma200;

                        if (smaType === 'golden_cross' && currentRatio > 0 && lastValue <= 0) {
                            // SMA50 crossed above SMA200
                            conditionMet = true;
                            notificationMessage = `🌟 GOLDEN CROSS en ${alert.ticker}!\n\nSMA50 (${sma50.toFixed(2)}) ha cruzado por encima de SMA200 (${sma200.toFixed(2)}).\nEsto es una señal alcista.\n\nPrecio: ${currentPrice.toFixed(2)}`;
                        } else if (smaType === 'death_cross' && currentRatio < 0 && lastValue >= 0) {
                            // SMA50 crossed below SMA200
                            conditionMet = true;
                            notificationMessage = `💀 DEATH CROSS en ${alert.ticker}!\n\nSMA50 (${sma50.toFixed(2)}) ha cruzado por debajo de SMA200 (${sma200.toFixed(2)}).\nEsto es una señal bajista.\n\nPrecio: ${currentPrice.toFixed(2)}`;
                        }

                        // Update last indicator value
                        await sql`UPDATE alerts SET last_indicator_value = ${currentRatio} WHERE id = ${alert.id}`;
                    }
                } catch (e) {
                    console.error(`Error checking SMA cross alert for ${alert.ticker}:`, e);
                }
            }

            if (conditionMet) {


                const companyName = quote.name || alert.ticker;

                // Build stop URL for quick deactivation
                const appUrl = process.env.APP_URL || 'http://localhost:3000';
                const stopUrl = `${appUrl}/#/stop-alert/${alert.deactivation_token}`;
                const stopLink = `\n\n🛑 Desactivar alerta: ${stopUrl}`;

                // Append stop link to notification message
                const messageWithStopLink = notificationMessage + stopLink;

                // Send Email (Check if disabled by user)
                const emailConfig = await sql`
                    SELECT is_active FROM notification_channels 
                    WHERE user_id = ${alert.user_id} AND channel_type = 'email'
                `;

                const emailActive = emailConfig.length === 0 || emailConfig[0].is_active;

                if (emailActive) {
                    await AlertService.sendAlertEmail(alert.email, alert, currentPrice, messageWithStopLink);
                }

                // Send Notifications (Telegram, Discord, Teams) - all include stop link
                const title = `🔔 Alerta: ${companyName}`;
                await NotificationService.dispatch(alert.user_id, title, messageWithStopLink);

                // Update alert based on repeatability
                if (alert.is_repeatable) {
                    // Set triggered=true and update last_triggered_at (cooldown will be checked on next run)
                    await sql`
                        UPDATE alerts 
                        SET triggered = true, last_triggered_at = NOW(), last_checked_at = NOW()
                        WHERE id = ${alert.id}
                    `;
                } else {
                    // Deactivate the alert
                    await sql`
                        UPDATE alerts 
                        SET triggered = true, is_active = false, last_checked_at = NOW() 
                        WHERE id = ${alert.id}
                    `;
                }
            } else {
                await sql`UPDATE alerts SET last_checked_at = NOW() WHERE id = ${alert.id}`;
            }
        }
    },


    sendAlertEmail: async (to: string, alert: any, currentPrice: number, notificationMessage?: string) => {
        if (process.env.NODE_ENV === 'test') return;
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

        const alertType = alert.alert_type || 'price';
        const emailBody = notificationMessage || `Alerta para ${alert.ticker} - Precio actual: ${currentPrice.toFixed(2)}`;
        const isRepeatable = alert.is_repeatable ? '<p style="color: #666; font-size: 0.9em;">Esta es una alerta repetible y se mantendrá activa.</p>' : '<p>La alerta ha sido desactivada automáticamente.</p>';

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
                        <p style="margin: 5px 0; white-space: pre-line;">${emailBody}</p>
                    </div>

                    ${isRepeatable}
                    <p>Puedes gestionar tus alertas en el panel de control.</p>
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 0.8em; color: #888;">Este es un mensaje automático de Stocks Manager.</p>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);

        } catch (error) {
            console.error('Error sending alert email:', error);
        }
    }
};
