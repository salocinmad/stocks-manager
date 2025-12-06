import express from 'express';
import { authenticate } from '../middleware/auth.js';
import YahooFinance from 'yahoo-finance2';
import Config from '../models/Config.js';

// Instancia de Yahoo Finance v3
const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
  queue: {
    concurrency: 1,
    timeout: 300
  }
});

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

router.get('/quote/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({ error: 'Símbolo requerido' });
    }

    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;

    const response = await fetch(yahooUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Error al consultar Yahoo Finance: ${response.status}`
      });
    }

    const data = await response.json();

    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      return res.status(404).json({
        error: `Símbolo ${symbol} no encontrado en Yahoo Finance`
      });
    }

    const result = data.chart.result[0];
    if (!result.meta) {
      return res.status(404).json({ error: 'Datos incompletos en Yahoo Finance' });
    }

    const meta = result.meta;
    const regularMarketPrice = meta.regularMarketPrice;

    if (!regularMarketPrice || regularMarketPrice === 0) {
      return res.status(404).json({ error: 'Precio no disponible en Yahoo Finance' });
    }

    const previousClose = (
      meta.regularMarketPreviousClose ??
      meta.chartPreviousClose ??
      meta.previousClose ??
      regularMarketPrice
    );
    const change = regularMarketPrice - previousClose;
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

    res.json({
      price: regularMarketPrice,
      change: change,
      changePercent: changePercent,
      high: meta.regularMarketDayHigh || regularMarketPrice,
      low: meta.regularMarketDayLow || regularMarketPrice,
      open: meta.regularMarketOpen || regularMarketPrice,
      previousClose: previousClose,
      symbol: symbol,
      source: 'Yahoo Finance'
    });
  } catch (error) {
    console.error('Error fetching from Yahoo Finance:', error);
    res.status(500).json({ error: error.message || 'Error al consultar Yahoo Finance' });
  }
})

export default router;
router.get('/fx/eurusd', async (req, res) => {
  try {
    let key = process.env.FINNHUB_API_KEY || '';
    if (!key) {
      const row = await Config.findOne({ where: { key: 'finnhub_api_key' } });
      key = row?.value || '';
    }
    if (key) {
      const r1 = await fetch(`https://finnhub.io/api/v1/forex/rates?base=USD&token=${encodeURIComponent(key)}`);
      if (r1.ok) {
        const data = await r1.json();
        const eur = Number(data?.rates?.EUR);
        if (eur && eur > 0) {
          return res.json({ eurPerUsd: eur, source: 'finnhub' });
        }
      }
    }
    const q = await yahooFinance.quote('EURUSD=X');
    const r = q?.regularMarketPrice || q?.regularMarketPreviousClose || null;
    console.log(`💱 Yahoo EUR/USD: ${r} (Source: ${q?.regularMarketPrice ? 'price' : 'close'})`);
    if (!r || r <= 0) {
      return res.status(502).json({ error: 'Tipo de cambio no disponible' });
    }
    const eurPerUsd = 1 / r;
    res.json({ eurPerUsd, source: 'yahoo' });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error al obtener tipo de cambio' });
  }
});

