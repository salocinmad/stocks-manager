/**
 * Portfolio Alert Service v2.1.0
 * 
 * Handles portfolio-level alerts:
 * - PnL thresholds (above/below)
 * - Total value thresholds
 * - Sector exposure limits
 */

import sql from '../db';
import { MarketDataService } from './marketData';
import { NotificationService } from './notificationService';
import { SettingsService } from './settingsService';
import nodemailer from 'nodemailer';

export const PortfolioAlertService = {
    /**
     * Check all active portfolio alerts
     */
    checkPortfolioAlerts: async () => {
        console.log('[PortfolioAlerts] Checking portfolio alerts...');

        try {
            // Fetch active portfolio alerts
            const alerts = await sql`
                SELECT pa.*, u.email, p.name as portfolio_name
                FROM portfolio_alerts pa
                JOIN users u ON pa.user_id = u.id
                JOIN portfolios p ON pa.portfolio_id = p.id
                WHERE pa.is_active = true
                AND (
                    pa.triggered = false
                    OR (pa.is_repeatable = true AND (
                        pa.last_triggered_at IS NULL
                        OR pa.last_triggered_at < NOW() - (pa.repeat_cooldown_hours || ' hours')::interval
                    ))
                )
            `;

            if (alerts.length === 0) {
                return;
            }

            console.log(`[PortfolioAlerts] Found ${alerts.length} active portfolio alerts`);

            for (const alert of alerts) {
                try {
                    await PortfolioAlertService.processAlert(alert);
                } catch (e) {
                    console.error(`[PortfolioAlerts] Error processing alert ${alert.id}:`, e);
                }
            }
        } catch (e) {
            console.error('[PortfolioAlerts] Error checking alerts:', e);
        }
    },

    /**
     * Process a single portfolio alert
     */
    processAlert: async (alert: any) => {
        const alertType = alert.alert_type;
        let conditionMet = false;
        let notificationMessage = '';

        // Get portfolio positions
        const positions = await sql`
            SELECT p.*, 
                   (SELECT data->>'c' FROM market_cache mc WHERE mc.key = 'quote:' || p.ticker LIMIT 1) as current_price
            FROM positions p
            WHERE p.portfolio_id = ${alert.portfolio_id}
            AND p.quantity > 0
        `;

        if (positions.length === 0) return;

        // Calculate portfolio totals
        let totalValue = 0;
        let totalCost = 0;

        for (const pos of positions) {
            const price = pos.current_price ? parseFloat(pos.current_price) : 0;
            const qty = Number(pos.quantity);
            const avgPrice = Number(pos.average_buy_price);

            totalValue += qty * price;
            totalCost += qty * avgPrice;
        }

        const totalPnL = totalValue - totalCost;
        const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

        // Check alert conditions
        if (alertType === 'pnl_above') {
            const threshold = Number(alert.threshold_value) || 0;
            if (totalPnL >= threshold) {
                conditionMet = true;
                notificationMessage = `🎉 ¡Tu cartera "${alert.portfolio_name}" ha superado tu objetivo de beneficios!\n\nPnL actual: ${totalPnL.toFixed(2)}€ (${totalPnLPercent.toFixed(2)}%)\nObjetivo: ${threshold.toFixed(2)}€`;
            }
        } else if (alertType === 'pnl_below') {
            const threshold = Number(alert.threshold_value) || 0;
            if (totalPnL <= threshold) {
                conditionMet = true;
                notificationMessage = `⚠️ Tu cartera "${alert.portfolio_name}" ha caído por debajo del umbral de pérdidas.\n\nPnL actual: ${totalPnL.toFixed(2)}€ (${totalPnLPercent.toFixed(2)}%)\nUmbral: ${threshold.toFixed(2)}€`;
            }
        } else if (alertType === 'pnl_percent_above') {
            const threshold = Number(alert.threshold_percent) || 10;
            if (totalPnLPercent >= threshold) {
                conditionMet = true;
                notificationMessage = `🎉 ¡Tu cartera "${alert.portfolio_name}" ha alcanzado un ${totalPnLPercent.toFixed(2)}% de rentabilidad!\n\nPnL: ${totalPnL.toFixed(2)}€\nObjetivo: +${threshold}%`;
            }
        } else if (alertType === 'pnl_percent_below') {
            const threshold = Number(alert.threshold_percent) || -10;
            if (totalPnLPercent <= threshold) {
                conditionMet = true;
                notificationMessage = `⚠️ Tu cartera "${alert.portfolio_name}" ha caído un ${totalPnLPercent.toFixed(2)}%.\n\nPnL: ${totalPnL.toFixed(2)}€\nUmbral: ${threshold}%`;
            }
        } else if (alertType === 'value_above') {
            const threshold = Number(alert.threshold_value) || 0;
            if (totalValue >= threshold) {
                conditionMet = true;
                notificationMessage = `📈 Tu cartera "${alert.portfolio_name}" ha alcanzado un valor de ${totalValue.toFixed(2)}€!\n\nValor objetivo: ${threshold.toFixed(2)}€`;
            }
        } else if (alertType === 'value_below') {
            const threshold = Number(alert.threshold_value) || 0;
            if (totalValue <= threshold) {
                conditionMet = true;
                notificationMessage = `📉 Tu cartera "${alert.portfolio_name}" ha caído por debajo de ${threshold.toFixed(2)}€.\n\nValor actual: ${totalValue.toFixed(2)}€`;
            }
        } else if (alertType === 'sector_exposure') {
            // Check if a sector exceeds threshold percentage
            const targetSector = alert.sector_target;
            const threshold = Number(alert.threshold_percent) || 30;

            if (!targetSector) return;

            // Get sector data from profiles
            let sectorValue = 0;
            for (const pos of positions) {
                try {
                    const profile = await MarketDataService.getAssetProfile(pos.ticker);
                    if (profile?.sector === targetSector) {
                        const price = pos.current_price ? parseFloat(pos.current_price) : 0;
                        sectorValue += Number(pos.quantity) * price;
                    }
                } catch (e) {
                    // Skip if profile not available
                }
            }

            const sectorPercent = totalValue > 0 ? (sectorValue / totalValue) * 100 : 0;

            if (sectorPercent >= threshold) {
                conditionMet = true;
                notificationMessage = `⚠️ Alerta de exposición sectorial en "${alert.portfolio_name}".\n\nSector "${targetSector}" representa el ${sectorPercent.toFixed(1)}% de tu cartera.\nUmbral configurado: ${threshold}%`;
            }
        }

        // Trigger notifications if condition met
        if (conditionMet) {
            console.log(`[PortfolioAlerts] Alert triggered for portfolio ${alert.portfolio_name}`);

            // Send notifications
            const title = `🔔 Alerta de Cartera: ${alert.portfolio_name}`;
            await NotificationService.dispatch(alert.user_id, title, notificationMessage);

            // Send email
            await PortfolioAlertService.sendAlertEmail(alert.email, alert, notificationMessage);

            // Update alert
            if (alert.is_repeatable) {
                await sql`
                    UPDATE portfolio_alerts 
                    SET triggered = true, last_triggered_at = NOW()
                    WHERE id = ${alert.id}
                `;
            } else {
                await sql`
                    UPDATE portfolio_alerts 
                    SET triggered = true, is_active = false
                    WHERE id = ${alert.id}
                `;
            }
        }
    },

    /**
     * Send alert email
     */
    sendAlertEmail: async (to: string, alert: any, message: string) => {
        const smtpConfig = await SettingsService.getSmtpConfig();

        if (!smtpConfig.host || !smtpConfig.user) {
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

        const mailOptions = {
            from: smtpConfig.from || smtpConfig.user,
            to: to,
            subject: `🔔 Alerta de Cartera: ${alert.portfolio_name}`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 10px; padding: 20px;">
                    <h2 style="color: #2563eb;">Stocks Manager - Alerta de Cartera</h2>
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; white-space: pre-line;">
                        ${message}
                    </div>
                    <p>Puedes gestionar tus alertas en el panel de control.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 0.8em; color: #888;">Este es un mensaje automático de Stocks Manager.</p>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
        } catch (error) {
            console.error('Error sending portfolio alert email:', error);
        }
    }
};
