import express from 'express';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Obtener precio de Yahoo Finance
router.get('/quote/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Símbolo requerido' });
    }

    // Construir URL de Yahoo Finance
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;

    // Hacer la petición desde el servidor (sin problemas de CORS)
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

    const previousClose = meta.previousClose || regularMarketPrice;
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
});

export default router;

