import express from 'express';
import { authenticate } from '../middleware/auth.js';
import PositionOrder from '../models/PositionOrder.js';
import Portfolio from '../models/Portfolio.js';
import User from '../models/User.js';
import DailyPrice from '../models/DailyPrice.js';
import Operation from '../models/Operation.js'; // Importar modelo Operation
import { Op } from 'sequelize';

const router = express.Router();

// GET /api/positions/order - Obtener orden de posiciones personalizado del usuario
router.get('/order', authenticate, async (req, res) => {
    try {
        const portfolioId = await resolvePortfolioId(req);
        const orders = await PositionOrder.findAll({
            where: { userId: req.user.id, portfolioId },
            order: [['displayOrder', 'ASC']]
        });

        // Devolver array de positionKeys en orden
        const orderedKeys = orders.map(o => o.positionKey);
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
        await PositionOrder.destroy({
            where: { userId: req.user.id, portfolioId }
        });

        // Crear nuevas entradas de orden
        const orderEntries = order.map((positionKey, index) => ({
            userId: req.user.id,
            portfolioId,
            positionKey,
            displayOrder: index
        }));

        if (orderEntries.length > 0) {
            await PositionOrder.bulkCreate(orderEntries);
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
        const historicalData = await DailyPrice.findAll({
            where: {
                userId: req.user.id,
                portfolioId,
                positionKey: decodedPositionKey,
                date: { [Op.gte]: dateLimitStr }
            },
            attributes: ['date', 'open', 'high', 'low', 'close', 'volume'],
            order: [['date', 'ASC']]
        });

        // Obtener operaciones para marcadores
        // Extraer símbolo puro si tiene formato "EXCHANGE:SYMBOL"
        let searchSymbol = decodedPositionKey;
        if (decodedPositionKey.includes(':')) {
            searchSymbol = decodedPositionKey.split(':')[1];
        }

        const operations = await Operation.findAll({
            where: {
                userId: req.user.id,
                portfolioId,
                [Op.or]: [
                    { symbol: decodedPositionKey },
                    { symbol: searchSymbol },
                    { company: decodedPositionKey }
                ]
            },
            attributes: ['id', 'type', 'date', 'price', 'shares'],
            order: [['date', 'ASC']]
        });

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
        const exists = await Portfolio.count({ where: { id, userId } });
        if (exists) return id;
    }
    const u = await User.findByPk(userId);
    if (u?.favoritePortfolioId) return u.favoritePortfolioId;
    const first = await Portfolio.findOne({ where: { userId }, order: [['id', 'ASC']] });
    return first ? first.id : null;
}
