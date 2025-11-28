/**
 * Endpoints API modulares para precios
 */

import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as currentPriceService from '../../services/prices/currentPriceService.js';
import * as historicalPriceService from '../../services/prices/historicalPriceService.js';

const router = express.Router();

// Aplicar autenticación a todas las rutas
router.use(authenticate);

/**
 * GET /api/prices/current/:symbol
 * Obtiene precio actual de un símbolo
 */
router.get('/current/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const price = await currentPriceService.getCurrentPrice(symbol);

        if (!price) {
            return res.status(404).json({ error: 'Símbolo no encontrado' });
        }

        res.json(price);
    } catch (error) {
        console.error('Error in /current/:symbol:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/prices/current-batch?symbols=AAPL,MSFT,AMP.MC
 * Obtiene precios actuales de múltiples símbolos
 */
router.get('/current-batch', async (req, res) => {
    try {
        const { symbols } = req.query;

        if (!symbols) {
            return res.status(400).json({ error: 'Parámetro symbols requerido' });
        }

        const symbolList = symbols.split(',').map(s => s.trim());
        const prices = await currentPriceService.getCurrentBatch(symbolList);

        res.json(prices);
    } catch (error) {
        console.error('Error in /current-batch:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/prices/historical/:symbol?days=30
 * Obtiene histórico de precios de un símbolo
 */
router.get('/historical/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { days = 30 } = req.query;

        const history = await historicalPriceService.getHistoricalPrices(
            symbol,
            parseInt(days)
        );

        res.json({
            symbol,
            period: `${days} days`,
            count: history.length,
            data: history
        });
    } catch (error) {
        console.error('Error in /historical/:symbol:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/prices/update/:symbol
 * Actualiza precio de un símbolo manualmente
 */
router.post('/update/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const result = await currentPriceService.updateSinglePrice(symbol);

        if (!result) {
            return res.status(404).json({ error: 'No se pudo actualizar el precio' });
        }

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error in /update/:symbol:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
