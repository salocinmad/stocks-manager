import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import sql from '../db';
import { MarketDataService } from '../services/marketData';

export const alertsRoutes = new Elysia({ prefix: '/alerts' })
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

        if (!profile || !profile.sub) {
            set.status = 401;
            throw new Error('Unauthorized');
        }

        return { userId: profile.sub };
    })

    // Lista de Alertas (Combined Ticker + Portfolio)
    .get('/', async ({ userId }) => {
        // 1. Ticker Alerts
        const alerts = await sql`
            SELECT *, 'ticker' as scope FROM alerts 
            WHERE user_id = ${userId}
            ORDER BY created_at DESC
        `;

        // 2. Portfolio Alerts
        const portfolioAlerts = await sql`
            SELECT pa.*, p.name as portfolio_name, 'portfolio' as scope
            FROM portfolio_alerts pa
            JOIN portfolios p ON pa.portfolio_id = p.id
            WHERE pa.user_id = ${userId}
            ORDER BY pa.created_at DESC
        `;

        // Obtener cotizaciones para alertas de ticker
        const alertsWithPrice = await Promise.all(alerts.map(async (alert) => {
            try {
                const quote = await MarketDataService.getQuote(alert.ticker);
                const normalizedCondition = alert.condition?.toLowerCase() || null;
                return {
                    ...alert,
                    condition: normalizedCondition,
                    current_price: quote?.c || null,
                    companyName: quote?.name || alert.ticker
                };
            } catch (e) {
                return {
                    ...alert,
                    condition: alert.condition?.toLowerCase() || null,
                    current_price: null,
                    companyName: alert.ticker
                };
            }
        }));

        // Mapear alertas de portafolio para que encajen en la interfaz común
        const mappedPortfolioAlerts = portfolioAlerts.map(pa => ({
            ...pa,
            ticker: pa.portfolio_name, // Use portfolio name as "ticker" for display
            companyName: 'Portafolio Global',
            current_price: null,
            target_price: pa.threshold_value,
            percent_threshold: pa.threshold_percent,
            condition: pa.alert_type.includes('above') ? 'above' : 'below'
        }));

        // Combinar
        return [...alertsWithPrice, ...mappedPortfolioAlerts];
    })

    // Crear Alerta (Unified)
    .post('/', async ({ userId, body, set }) => {
        const {
            ticker,
            portfolio_id,
            alert_type = 'price',
            condition,
            target_price,
            percent_threshold,
            volume_multiplier,
            is_repeatable = false,
            repeat_cooldown_hours = 24
        } = body as any;

        // -- PORTFOLIO ALERT CREATION --
        if (portfolio_id || ['any_asset_change_percent', 'pnl_above', 'pnl_below', 'value_above', 'value_below'].includes(alert_type)) {
            if (!portfolio_id) {
                set.status = 400;
                throw new Error('Portfolio ID is required for this alert type');
            }

            const [newAlert] = await sql`
                INSERT INTO portfolio_alerts (
                    user_id, portfolio_id, alert_type, 
                    threshold_value, threshold_percent,
                    is_repeatable, repeat_cooldown_hours, is_active
                )
                VALUES (
                    ${userId}, 
                    ${portfolio_id}, 
                    ${alert_type},
                    ${target_price || null}, 
                    ${percent_threshold || null},
                    ${is_repeatable}, 
                    ${repeat_cooldown_hours}, 
                    true
                )
                RETURNING *
            `;

            // Fetch name for return
            const [portfolio] = await sql`SELECT name FROM portfolios WHERE id = ${portfolio_id}`;

            return {
                ...newAlert,
                scope: 'portfolio',
                ticker: portfolio?.name || 'Portfolio',
                companyName: 'Portafolio Global'
            };
        }

        // -- TICKER ALERT CREATION (Legacy) --
        if (!ticker) {
            set.status = 400;
            throw new Error('Ticker is required');
        }

        // Validate required fields based on alert type
        if (alert_type === 'price' && (!condition || target_price === undefined)) {
            set.status = 400;
            throw new Error('Price alerts require condition and target_price');
        }
        if (alert_type === 'percent_change' && !percent_threshold) {
            set.status = 400;
            throw new Error('Percent change alerts require percent_threshold');
        }
        if (alert_type === 'volume' && !volume_multiplier) {
            set.status = 400;
            throw new Error('Volume alerts require volume_multiplier');
        }

        // Validar ticker
        let quote;
        try {
            quote = await MarketDataService.getQuote(ticker);
        } catch (e) {
            set.status = 400;
            throw new Error('Invalid ticker');
        }

        const [newAlert] = await sql`
            INSERT INTO alerts (
                user_id, ticker, alert_type, condition, target_price, 
                percent_threshold, volume_multiplier, 
                is_repeatable, repeat_cooldown_hours, is_active
            )
            VALUES (
                ${userId}, 
                ${ticker.toUpperCase()}, 
                ${alert_type},
                ${condition?.toUpperCase() || null}, 
                ${target_price || null},
                ${percent_threshold || null},
                ${volume_multiplier || null},
                ${is_repeatable},
                ${repeat_cooldown_hours},
                true
            )
            RETURNING *
        `;

        return {
            ...newAlert,
            scope: 'ticker',
            condition: newAlert.condition?.toLowerCase(),
            companyName: quote?.name || ticker.toUpperCase()
        };
    })

    // Eliminar Alerta (Unified)
    .delete('/:id', async ({ userId, params }) => {
        // Try deleting from alerts first
        const deletedAlert = await sql`
            DELETE FROM alerts 
            WHERE id = ${params.id} AND user_id = ${userId}
            RETURNING id
        `;

        if (deletedAlert.length > 0) return { success: true };

        // Try deleting from portfolio_alerts
        const deletedPortfolioAlert = await sql`
            DELETE FROM portfolio_alerts
            WHERE id = ${params.id} AND user_id = ${userId}
            RETURNING id
        `;

        return { success: !!deletedPortfolioAlert.length };
    })

    // Editar Alerta (Unified)
    .put('/:id', async ({ userId, params, body }) => {
        // We figure out which table it belongs to by trying triggers on both, or checking existence first.
        // Or simpler: Try update 'alerts'. If count 0, try 'portfolio_alerts'.

        const {
            is_active,
            target_price, // maps to threshold_value for portfolio
            condition,
            percent_threshold, // maps to threshold_percent
            volume_multiplier,
            is_repeatable,
            repeat_cooldown_hours
        } = body as any;

        // Try Stock Alert Update
        const stockUpdate = await sql`
            UPDATE alerts SET 
                is_active = COALESCE(${is_active}, is_active),
                target_price = COALESCE(${target_price}, target_price),
                condition = COALESCE(${condition?.toUpperCase()}, condition),
                percent_threshold = COALESCE(${percent_threshold}, percent_threshold),
                volume_multiplier = COALESCE(${volume_multiplier}, volume_multiplier),
                is_repeatable = COALESCE(${is_repeatable}, is_repeatable),
                repeat_cooldown_hours = COALESCE(${repeat_cooldown_hours}, repeat_cooldown_hours),
                triggered = CASE WHEN (${is_active} IS NOT NULL OR ${target_price} IS NOT NULL) THEN false ELSE triggered END
            WHERE id = ${params.id} AND user_id = ${userId}
            RETURNING id
        `;

        if (stockUpdate.length > 0) return { success: true };

        // Try Portfolio Alert Update
        await sql`
            UPDATE portfolio_alerts SET
                is_active = COALESCE(${is_active}, is_active),
                threshold_value = COALESCE(${target_price}, threshold_value),
                threshold_percent = COALESCE(${percent_threshold}, threshold_percent),
                is_repeatable = COALESCE(${is_repeatable}, is_repeatable),
                repeat_cooldown_hours = COALESCE(${repeat_cooldown_hours}, repeat_cooldown_hours),
                triggered = CASE WHEN (${is_active} IS NOT NULL) THEN false ELSE triggered END
            WHERE id = ${params.id} AND user_id = ${userId}
        `;

        return { success: true };
    })

    // Reset Alert (Unified)
    .put('/:id/reset', async ({ userId, params }) => {
        // Try resetting stock alert
        const stockReset = await sql`
            UPDATE alerts SET 
                triggered = false,
                last_triggered_at = NULL,
                last_checked_at = NULL,
                is_active = true
            WHERE id = ${params.id} AND user_id = ${userId}
            RETURNING id
        `;

        if (stockReset.length > 0) return { success: true };

        // Try resetting portfolio alert
        await sql`
            UPDATE portfolio_alerts SET
                triggered = false,
                last_triggered_at = NULL,
                last_checked_at = NULL,
                is_active = true,
                triggered_assets = '{}'::jsonb
            WHERE id = ${params.id} AND user_id = ${userId}
        `;

        return { success: true };
    });
