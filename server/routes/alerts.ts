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

    // Lista de Alertas
    .get('/', async ({ userId }) => {
        const alerts = await sql`
            SELECT * FROM alerts 
            WHERE user_id = ${userId}
            ORDER BY created_at DESC
        `;

        // Obtener cotizaciones actuales para mostrarlas junto a la alerta
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

        return alertsWithPrice;
    })

    // Crear Alerta (supports price, percent_change, volume types)
    .post('/', async ({ userId, body, set }) => {
        const {
            ticker,
            alert_type = 'price',
            condition,
            target_price,
            percent_threshold,
            volume_multiplier,
            is_repeatable = false,
            repeat_cooldown_hours = 24
        } = body as any;

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
            condition: newAlert.condition?.toLowerCase(),
            companyName: quote?.name || ticker.toUpperCase()
        };
    })

    // Eliminar Alerta
    .delete('/:id', async ({ userId, params }) => {
        const deleted = await sql`
            DELETE FROM alerts 
            WHERE id = ${params.id} AND user_id = ${userId}
            RETURNING id
        `;
        return { success: !!deleted.length };
    })

    // Editar Alerta (supports all alert types and fields)
    .put('/:id', async ({ userId, params, body }) => {
        const {
            is_active,
            target_price,
            condition,
            percent_threshold,
            volume_multiplier,
            is_repeatable,
            repeat_cooldown_hours
        } = body as any;

        // Build dynamic update
        const updates: string[] = [];
        const values: any[] = [];

        if (is_active !== undefined) {
            await sql`UPDATE alerts SET is_active = ${is_active} WHERE id = ${params.id} AND user_id = ${userId}`;
        }

        if (target_price !== undefined) {
            await sql`UPDATE alerts SET target_price = ${target_price} WHERE id = ${params.id} AND user_id = ${userId}`;
        }

        if (condition !== undefined) {
            await sql`UPDATE alerts SET condition = ${condition?.toUpperCase() || null} WHERE id = ${params.id} AND user_id = ${userId}`;
        }

        if (percent_threshold !== undefined) {
            await sql`UPDATE alerts SET percent_threshold = ${percent_threshold} WHERE id = ${params.id} AND user_id = ${userId}`;
        }

        if (volume_multiplier !== undefined) {
            await sql`UPDATE alerts SET volume_multiplier = ${volume_multiplier} WHERE id = ${params.id} AND user_id = ${userId}`;
        }

        if (is_repeatable !== undefined) {
            await sql`UPDATE alerts SET is_repeatable = ${is_repeatable} WHERE id = ${params.id} AND user_id = ${userId}`;
        }

        if (repeat_cooldown_hours !== undefined) {
            await sql`UPDATE alerts SET repeat_cooldown_hours = ${repeat_cooldown_hours} WHERE id = ${params.id} AND user_id = ${userId}`;
        }

        // Reactivate and reset triggered on any value change (so alert can fire again)
        if (target_price !== undefined || condition !== undefined || percent_threshold !== undefined || volume_multiplier !== undefined) {
            await sql`UPDATE alerts SET is_active = true, triggered = false, last_triggered_at = NULL WHERE id = ${params.id} AND user_id = ${userId}`;
        }

        return { success: true };
    });
