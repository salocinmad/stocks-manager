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
                const normalizedCondition = alert.condition.toLowerCase();
                return {
                    ...alert,
                    condition: normalizedCondition,
                    current_price: quote?.c || null,
                    companyName: quote?.name || alert.ticker,
                    conditionLabel: normalizedCondition === 'above' ? 'Mayor que' : 'Menor que'
                };
            } catch (e) {
                const normalizedCondition = alert.condition.toLowerCase();
                return {
                    ...alert,
                    condition: normalizedCondition,
                    current_price: null,
                    companyName: alert.ticker,
                    conditionLabel: normalizedCondition === 'above' ? 'Mayor que' : 'Menor que'
                };
            }
        }));

        return alertsWithPrice;
    })

    // Crear Alerta
    .post('/', async ({ userId, body, set }) => {
        const { ticker, condition, target_price } = body as { ticker: string, condition: 'above' | 'below', target_price: number };

        if (!ticker || !condition || target_price === undefined) {
            set.status = 400;
            throw new Error('Missing fields');
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
            INSERT INTO alerts (user_id, ticker, condition, target_price, is_active)
            VALUES (${userId}, ${ticker.toUpperCase()}, ${condition.toUpperCase()}, ${target_price}, true)
            RETURNING *
        `;

        return {
            ...newAlert,
            condition: newAlert.condition.toLowerCase(),
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

    // Editar Alerta
    .put('/:id', async ({ userId, params, body }) => {
        const { is_active, target_price, condition } = body as any;

        let updateQuery = sql`UPDATE alerts SET updated_at = NOW()`; // Dummy start

        if (is_active !== undefined) {
            await sql`UPDATE alerts SET is_active = ${is_active} WHERE id = ${params.id} AND user_id = ${userId}`;
        }

        if (target_price !== undefined) {
            await sql`UPDATE alerts SET target_price = ${target_price} WHERE id = ${params.id} AND user_id = ${userId}`;
        }

        if (condition !== undefined) {
            await sql`UPDATE alerts SET condition = ${condition} WHERE id = ${params.id} AND user_id = ${userId}`;
        }

        // Reactivar si se edita
        if (target_price !== undefined || condition !== undefined) {
            await sql`UPDATE alerts SET is_active = true, triggered = false WHERE id = ${params.id} AND user_id = ${userId}`;
        }

        return { success: true };
    });
