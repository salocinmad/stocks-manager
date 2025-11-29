/**
 * Endpoints API modulares para precios
 */

import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as currentPriceService from '../../services/prices/currentPriceService.js';
import * as historicalPriceService from '../../services/prices/historicalPriceService.js';
import GlobalCurrentPrice from '../../models/GlobalCurrentPrice.js';
import { getSymbolFromPositionKey } from '../../utils/symbolHelpers.js';

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
 * POST /api/prices/bulk
 * Obtiene precios actuales para un array de positionKeys
 * Lee de GlobalCurrentPrices que contiene los valores correctos de change/changePercent
 */
router.post('/bulk', async (req, res) => {
    try {
        const { positionKeys } = req.body || {};
        if (!Array.isArray(positionKeys) || positionKeys.length === 0) {
            return res.status(400).json({ error: 'positionKeys requerido (array no vacío)' });
        }

        // Extraer símbolos únicos de positionKeys
        const symbols = [];
        positionKeys.forEach(pk => {
            const symbol = getSymbolFromPositionKey(pk);
            if (symbol && !symbols.includes(symbol)) {
                symbols.push(symbol);
            }
        });

        console.log('🔍 /api/prices/bulk - Símbolos extraídos:', symbols);

        // Obtener precios de GlobalCurrentPrices (nueva tabla con datos correctos)
        const rows = await GlobalCurrentPrice.findAll({
            where: { symbol: symbols }
        });

        console.log('📊 /api/prices/bulk - Registros encontrados:', rows.length);
        rows.forEach(r => {
            console.log(`   ${r.symbol}: change=${r.change}, changePercent=${r.changePercent}`);
        });

        // Mapear por positionKey para mantener compatibilidad con frontend
        const map = {};
        positionKeys.forEach(pk => {
            const symbol = getSymbolFromPositionKey(pk);
            const price = rows.find(r => r.symbol === symbol);

            if (price) {
                map[pk] = {
                    price: price.lastPrice,
                    change: price.change ?? 0,
                    changePercent: price.changePercent ?? 0,
                    source: price.source || 'unknown',
                    updatedAt: price.updatedAt
                };
                console.log(`✅ Mapeado ${pk}: change=${map[pk].change}, changePercent=${map[pk].changePercent}`);
            } else {
                console.log(`⚠️  No se encontró precio para ${pk} (symbol: ${symbol})`);
            }
        });

        res.json({ prices: map });
    } catch (error) {
        console.error('Error fetching cached prices:', error);
        res.status(500).json({ error: 'Error al obtener precios guardados' });
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
