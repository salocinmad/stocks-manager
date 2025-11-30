import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { fetchHistorical } from '../services/datasources/yahooService.js';
import DailyPrice from '../models/DailyPrice.js';
import { Op } from 'sequelize';

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

        // Primero intentar obtener desde la base de datos local (caché)
        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - daysToFetch);
        const dateLimitStr = dateLimit.toISOString().split('T')[0];

        const positionKey = decodedSymbol === '^GSPC' ? 'S&P 500|||^GSPC' : `${decodedSymbol}|||${decodedSymbol}`;

        const cachedData = await DailyPrice.findAll({
            where: {
                userId: 0,
                portfolioId: 0,
                positionKey: positionKey,
                date: { [Op.gte]: dateLimitStr }
            },
            attributes: ['date', 'open', 'high', 'low', 'close', 'volume'],
            order: [['date', 'ASC']]
        });

        // Si tenemos datos en caché, usarlos
        if (cachedData && cachedData.length > 0) {
            console.log(`Using cached market data for ${decodedSymbol}: ${cachedData.length} records`);
            return res.json({
                success: true,
                data: cachedData,
                source: 'cache'
            });
        }

        // Si no hay caché, obtener desde Yahoo Finance
        console.log(`No cache found, fetching from Yahoo Finance...`);
        const data = await fetchHistorical(decodedSymbol, daysToFetch);

        res.json({
            success: true,
            data: data,
            source: 'yahoo'
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
