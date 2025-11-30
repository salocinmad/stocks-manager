import express from 'express';
import { authenticate } from '../middleware/auth.js';
import PositionOrder from '../models/PositionOrder.js';
import Portfolio from '../models/Portfolio.js';
import User from '../models/User.js';
import DailyPrice from '../models/DailyPrice.js';
import { Op } from 'sequelize';

const router = express.Router();

// GET /api/positions/order - Get user's custom position order
router.get('/order', authenticate, async (req, res) => {
    try {
        const portfolioId = await resolvePortfolioId(req);
        const orders = await PositionOrder.findAll({
            where: { userId: req.user.id, portfolioId },
            order: [['displayOrder', 'ASC']]
        });

        // Return array of positionKeys in order
        const orderedKeys = orders.map(o => o.positionKey);
        res.json({ order: orderedKeys });
    } catch (error) {
        console.error('Error fetching position order:', error);
        res.status(500).json({ error: 'Error al obtener el orden de posiciones' });
    }
});

// PUT /api/positions/order - Update user's custom position order
router.put('/order', authenticate, async (req, res) => {
    try {
        const { order } = req.body;

        if (!Array.isArray(order)) {
            return res.status(400).json({ error: 'El orden debe ser un array de positionKeys' });
        }

        // Delete existing order for this user
        const portfolioId = await resolvePortfolioId(req);
        await PositionOrder.destroy({
            where: { userId: req.user.id, portfolioId }
        });

        // Create new order entries
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

// GET /api/positions/history/:positionKey - Get historical price data for a specific position
// Query params: ?days=30 (default 30, supports 7, 30, 90, 180, 365)
router.get('/history/:positionKey', authenticate, async (req, res) => {
    try {
        const portfolioId = await resolvePortfolioId(req);
        const { positionKey } = req.params;
        const { days } = req.query;

        // Decode positionKey (may contain special characters like |||)
        const decodedPositionKey = decodeURIComponent(positionKey);

        // Parse days parameter, default to 30, max 365
        let daysToFetch = parseInt(days) || 30;
        daysToFetch = Math.min(Math.max(daysToFetch, 1), 365); // Clamp between 1 and 365

        // Calculate date limit
        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - daysToFetch);
        const dateLimitStr = dateLimit.toISOString().split('T')[0];

        // Fetch historical data from DailyPrice
        const historicalData = await DailyPrice.findAll({
            where: {
                userId: req.user.id,
                portfolioId,
                positionKey: decodedPositionKey,
                date: { [Op.gte]: dateLimitStr }
            },
            attributes: ['date', 'open', 'high', 'low', 'close'],
            order: [['date', 'ASC']]
        });

        res.json({
            success: true,
            data: historicalData,
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
