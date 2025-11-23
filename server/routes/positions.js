import express from 'express';
import { authenticate } from '../middleware/auth.js';
import PositionOrder from '../models/PositionOrder.js';

const router = express.Router();

// GET /api/positions/order - Get user's custom position order
router.get('/order', authenticate, async (req, res) => {
    try {
        const orders = await PositionOrder.findAll({
            where: { userId: req.user.id },
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
        await PositionOrder.destroy({
            where: { userId: req.user.id }
        });

        // Create new order entries
        const orderEntries = order.map((positionKey, index) => ({
            userId: req.user.id,
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

export default router;
