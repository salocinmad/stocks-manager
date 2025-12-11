import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { db } from '../config/database.js';
import * as schema from '../drizzle/schema.js';
import { eq, and, asc, gte, or, count } from 'drizzle-orm';

const router = express.Router();

// GET /api/positions/order - Obtener orden de posiciones personalizado del usuario
router.get('/order', authenticate, async (req, res) => {
    try {
        const portfolioId = await resolvePortfolioId(req);
        const ordersResult = await db.select({ positionKey: schema.positionOrders.positionKey })
            .from(schema.positionOrders)
            .where(and(eq(schema.positionOrders.userId, req.user.id), eq(schema.positionOrders.portfolioId, portfolioId)))
            .orderBy(asc(schema.positionOrders.displayOrder));

        // Devolver array de positionKeys en orden
        const orderedKeys = ordersResult.map(o => o.positionKey);
        res.json({ order: orderedKeys });
    } catch (error) {
        console.error('Error fetching position order:', error);
        res.status(500).json({ error: 'Error al obtener el orden de posiciones' });
    }
});

// PUT /api/positions/order - Actualizar orden de posiciones personalizado del usuario
router.put('/order', authenticate, async (req, res) => {
    try {
        const { order } = req.body;

        if (!Array.isArray(order)) {
            return res.status(400).json({ error: 'El orden debe ser un array de positionKeys' });
        }

        // Eliminar orden existente para este usuario
        const portfolioId = await resolvePortfolioId(req);
        await db.delete(schema.positionOrders).where(
            and(
                eq(schema.positionOrders.userId, req.user.id),
                eq(schema.positionOrders.portfolioId, portfolioId)
            )
        );

        // Crear nuevas entradas de orden
        const orderEntries = order.map((positionKey, index) => ({
            userId: req.user.id,
            portfolioId,
            positionKey,
            displayOrder: index
        }));

        if (orderEntries.length > 0) {
            await db.insert(schema.positionOrders).values(orderEntries).onConflictDoNothing();
        }

        res.json({ success: true, message: 'Orden actualizado correctamente' });
    } catch (error) {
        console.error('Error updating position order:', error);
        res.status(500).json({ error: 'Error al actualizar el orden de posiciones' });
    }
});

// GET /api/positions/history/:positionKey - Obtener datos históricos de precios para una posición específica
// Parámetros de consulta: ?days=30 (por defecto 30, soporta 7, 30, 90, 180, 365)
router.get('/history/:positionKey', authenticate, async (req, res) => {
    try {
        const portfolioId = await resolvePortfolioId(req);
        const { positionKey } = req.params;
        const { days } = req.query;

        // Decodificar positionKey (puede contener caracteres especiales como |||)
        const decodedPositionKey = decodeURIComponent(positionKey);

        // Analizar parámetro days, por defecto 30, máx 365
        let daysToFetch = parseInt(days) || 30;
        daysToFetch = Math.min(Math.max(daysToFetch, 1), 365); // Limitar entre 1 y 365

        // Calcular límite de fecha
        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - daysToFetch);
        const dateLimitStr = dateLimit.toISOString().split('T')[0];

        // Obtener datos históricos de DailyPrice
        const historicalData = await db.query.dailyPrices.findMany({
            where: and(
                eq(schema.dailyPrices.userId, req.user.id),
                eq(schema.dailyPrices.portfolioId, portfolioId),
                eq(schema.dailyPrices.positionKey, decodedPositionKey),
                gte(schema.dailyPrices.date, dateLimitStr)
            ),
            columns: {
                date: true,
                open: true,
                high: true,
                low: true,
                close: true,
                volume: true
            },
            orderBy: [asc(schema.dailyPrices.date)]
        });

        // Obtener operaciones para marcadores
        // Extraer símbolo puro si tiene formato "EXCHANGE:SYMBOL"
        let searchSymbol = decodedPositionKey;
        if (decodedPositionKey.includes(':')) {
            searchSymbol = decodedPositionKey.split(':')[1];
        }

        const operations = await db.select({
            id: schema.operations.id,
            type: schema.operations.type,
            date: schema.operations.date,
            price: schema.operations.price,
            shares: schema.operations.shares
        }).from(schema.operations).where(
            and(
                eq(schema.operations.userId, req.user.id),
                eq(schema.operations.portfolioId, portfolioId),
                or(
                    eq(schema.operations.symbol, decodedPositionKey),
                    eq(schema.operations.symbol, searchSymbol),
                    eq(schema.operations.company, decodedPositionKey)
                )
            )
        ).orderBy(asc(schema.operations.date));

        res.json({
            success: true,
            data: historicalData,
            operations: operations,
            daysRequested: daysToFetch,
            daysReturned: historicalData.length
        });
    } catch (error) {
        console.error('Error fetching historical data:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener datos históricos'
        });
    }
});

export default router;

async function resolvePortfolioId(req) {
    const userId = req.user.id;
    const raw = req.query.portfolioId || req.body?.portfolioId;
    const id = raw ? parseInt(raw, 10) : null;
    if (id) {
        const result = await db.select({ cnt: count() }).from(schema.portfolios)
            .where(and(eq(schema.portfolios.id, id), eq(schema.portfolios.userId, userId)));
        if (result[0]?.cnt > 0) return id;
    }
    const uResult = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    const u = uResult[0];
    if (u?.favoritePortfolioId) return u.favoritePortfolioId;
    const firstResult = await db.select({ id: schema.portfolios.id }).from(schema.portfolios)
        .where(eq(schema.portfolios.userId, userId))
        .orderBy(asc(schema.portfolios.id))
        .limit(1);
    const first = firstResult[0];
    return first ? first.id : null;
}
