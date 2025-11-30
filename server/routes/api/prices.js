/**
 * Endpoints API modulares para precios
 */

import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as currentPriceService from '../../services/prices/currentPriceService.js';
import * as historicalPriceService from '../../services/prices/historicalPriceService.js';
import GlobalCurrentPrice from '../../models/GlobalCurrentPrice.js';
import PriceCache from '../../models/PriceCache.js';
import Operation from '../../models/Operation.js';
import Portfolio from '../../models/Portfolio.js';
import User from '../../models/User.js';
import Config from '../../models/Config.js';
import { sendNotification } from '../../services/notify.js';
import { getSymbolFromPositionKey } from '../../utils/symbolHelpers.js';
import DailyPrice from '../../models/DailyPrice.js';
import { Op } from 'sequelize';

const router = express.Router();

// console.log('🚀 routes/api/prices.js LOADED - endpoints: /bulk, /current/:symbol, /historical/:symbol, /update/:symbol');

// Aplicar autenticación a todas las rutas
router.use(authenticate);

async function resolvePortfolioId(req) {
  const userId = req.user.id
  const raw = req.query.portfolioId || req.body?.portfolioId
  const id = raw ? parseInt(raw, 10) : null
  if (id) {
    const exists = await Portfolio.count({ where: { id, userId } })
    if (exists) return id
  }
  const u = await User.findByPk(userId)
  if (u?.favoritePortfolioId) return u.favoritePortfolioId
  const first = await Portfolio.findOne({ where: { userId }, order: [['id', 'ASC']] })
  return first ? first.id : null
}

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

    // console.log('🔍 /api/prices/bulk - Símbolos extraídos:', symbols);

    // Obtener precios de GlobalCurrentPrices (nueva tabla con datos correctos)
    const rows = await GlobalCurrentPrice.findAll({
      where: { symbol: symbols }
    });

    // console.log('📊 /api/prices/bulk - Registros encontrados:', rows.length);
    rows.forEach(r => {
      // console.log(`   ${r.symbol}: change=${r.change}, changePercent=${r.changePercent}`);
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
        // console.log(`✅ Mapeado ${pk}: change=${map[pk].change}, changePercent=${map[pk].changePercent}`);
      } else {
        // console.log(`⚠️  No se encontró precio para ${pk} (symbol: ${symbol})`);
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

router.put('/:positionKey', async (req, res) => {
  try {
    const { positionKey } = req.params
    const { price, change = null, changePercent = null, source = null } = req.body || {}
    if (typeof price !== 'number' || isNaN(price)) {
      return res.status(400).json({ error: 'price numérico requerido' })
    }

    const portfolioId = await resolvePortfolioId(req)
    const existing = await PriceCache.findOne({
      where: { userId: req.user.id, portfolioId, positionKey }
    })

    if (existing) {
      await existing.update({ lastPrice: price, change, changePercent, source, updatedAt: new Date() })
    } else {
      await PriceCache.create({
        userId: req.user.id,
        portfolioId,
        positionKey,
        lastPrice: price,
        change,
        changePercent,
        source
      })
    }

    // Check target price and notify
    try {
      const [company, symbol] = positionKey.includes('|||') ? positionKey.split('|||') : [positionKey, '']
      const where = symbol ? { userId: req.user.id, portfolioId, company, symbol } : { userId: req.user.id, portfolioId, company, symbol: '' }
      const ops = await Operation.findAll({ where })
      const purchases = ops.filter(o => o.type === 'purchase' && o.targetPrice && o.targetPrice > 0)
      if (purchases.length > 0) {
        // Use latest purchase's targetPrice
        purchases.sort((a, b) => new Date(b.date) - new Date(a.date))
        const target = purchases[0].targetPrice
        if (typeof target === 'number' && price >= target) {
          const cacheRow = await PriceCache.findOne({ where: { userId: req.user.id, portfolioId, positionKey } })
          const already = cacheRow?.targetHitNotifiedAt
          if (!already) {
            const subjectCfg = await Config.findOne({ where: { key: 'smtp_subject' } })
            const subjectBase = subjectCfg?.value || 'Alerta de precios'
            const niceName = symbol ? `${company} (${symbol})` : company
            const r = await sendNotification({
              subject: `${subjectBase}: ${niceName} alcanzó objetivo`,
              text: `${niceName} ha alcanzado el precio objetivo de ${target}. Precio actual: ${price}.`,
              html: `<p><b>${niceName}</b> ha alcanzado el precio objetivo de <b>${target}</b>.<br/>Precio actual: <b>${price}</b>.</p>`
            })
            if (r.ok && cacheRow) {
              await cacheRow.update({ targetHitNotifiedAt: new Date() })
            }
          }
        }
      }
    } catch (e) {
      // swallow notification errors to not break price upsert
    }
    res.json({ success: true })
  } catch (error) {
    console.error('Error upserting cached price:', error)
    res.status(500).json({ error: 'Error al guardar precio' })
  }
})

/**
 * GET /api/prices/historical-position
 * Obtiene datos históricos de una posición específica (DailyPrice)
 * Query params:
 *   - positionKey: Clave de la posición (requerido)
 *   - portfolioId: ID del portafolio (requerido)
 *   - days: Número de días (default: 30)
 */
router.get('/historical-position', async (req, res) => {
  try {
    const { positionKey, portfolioId, days = 30 } = req.query;
    const userId = req.user.id;

    if (!positionKey || !portfolioId) {
      return res.status(400).json({ error: 'positionKey and portfolioId are required' });
    }

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));

    const dailyPrices = await DailyPrice.findAll({
      where: {
        userId,
        portfolioId: parseInt(portfolioId),
        positionKey,
        date: {
          [Op.gte]: daysAgo.toISOString().split('T')[0]
        }
      },
      order: [['date', 'ASC']],
      limit: parseInt(days) + 5 // Un poco de margen
    });

    const data = dailyPrices.map(dp => ({
      date: dp.date,
      value: parseFloat(dp.close), // Mantener 'value' para compatibilidad con el gráfico de líneas
      open: parseFloat(dp.open),
      high: parseFloat(dp.high),
      low: parseFloat(dp.low),
      close: parseFloat(dp.close)
    }));

    res.json(data);
  } catch (error) {
    console.error('Error fetching historical position data:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
