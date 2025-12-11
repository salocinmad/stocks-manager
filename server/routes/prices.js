import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { fetchHistorical } from '../services/datasources/yahooService.js';
import { db } from '../config/database.js';
import * as schema from '../drizzle/schema.js';
import { eq, and, gte, asc } from 'drizzle-orm';

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

        const cachedData = await db.select({
            date: schema.dailyPrices.date,
            open: schema.dailyPrices.open,
            high: schema.dailyPrices.high,
            low: schema.dailyPrices.low,
            close: schema.dailyPrices.close,
            volume: schema.dailyPrices.volume
        }).from(schema.dailyPrices).where(and(
            eq(schema.dailyPrices.userId, 0),
            eq(schema.dailyPrices.portfolioId, 0),
            eq(schema.dailyPrices.positionKey, positionKey),
            gte(schema.dailyPrices.date, dateLimitStr)
        )).orderBy(asc(schema.dailyPrices.date));

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
