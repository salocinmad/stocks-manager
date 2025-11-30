import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { fetchHistorical } from '../services/datasources/yahooService.js';

const router = express.Router();

router.use(authenticate);

// GET /api/prices/market/:symbol - Get historical market data (e.g., ^GSPC)
router.get('/market/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { days } = req.query;

        const daysToFetch = parseInt(days) || 365;
        const decodedSymbol = decodeURIComponent(symbol);

        console.log(`Fetching market data for ${decodedSymbol} (${daysToFetch} days)`);

        const data = await fetchHistorical(decodedSymbol, daysToFetch);

        res.json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('Error fetching market data:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener datos de mercado'
        });
    }
});

export default router;
