import { Elysia } from 'elysia';
import sql from '../db';

// Public routes that don't require authentication
export const publicRoutes = new Elysia({ prefix: '/public' })
    // Stop alert by deactivation token (no auth required)
    .get('/alerts/stop/:token', async ({ params, set }) => {
        const { token } = params;

        // Find and deactivate the alert by token
        const result = await sql`
            UPDATE alerts 
            SET is_active = false, triggered = true
            WHERE deactivation_token = ${token}
            RETURNING id, ticker, user_id
        `;

        if (result.length === 0) {
            set.status = 404;
            return {
                success: false,
                message: 'Alerta no encontrada o ya desactivada'
            };
        }

        const alert = result[0];

        return {
            success: true,
            message: `Alerta para ${alert.ticker} desactivada correctamente`,
            alertId: alert.id,
            ticker: alert.ticker
        };
    })

    // Get alert info by token (for showing confirmation page details)
    .get('/alerts/info/:token', async ({ params, set }) => {
        const { token } = params;

        const alerts = await sql`
            SELECT id, ticker, alert_type, target_price, percent_threshold, volume_multiplier, 
                   condition, is_active, is_repeatable
            FROM alerts 
            WHERE deactivation_token = ${token}
        `;

        if (alerts.length === 0) {
            set.status = 404;
            return { found: false };
        }

        return {
            found: true,
            alert: alerts[0]
        };
    });
