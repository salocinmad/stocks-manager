/**
 * Servicio Yahoo Finance - API de precios y datos históricos
 * Usa fetch directo como el legacy system (routes/yahoo.js)
 * La librería yahoo-finance2 tiene problemas de conectividad en Docker
 */

import { getPreviousMarketDay } from '../../utils/dateHelpers.js';

/**
 * Obtiene quote de Yahoo Finance usando fetch directo
 * @param {string} symbol - Símbolo bursátil
 * @returns {Promise<Object|null>} Datos de precio o null
 */
export async function fetchQuote(symbol) {
    try {
        console.log(`📞 Yahoo API (fetch directo) para '${symbol}'...`);

        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;

        const response = await fetch(yahooUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });

        if (!response.ok) {
            console.log(`⚠️  Yahoo ${symbol}: HTTP ${response.status}`);
            return null;
        }

        const data = await response.json();

        if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
            console.log(`⚠️  Yahoo ${symbol}: No data in chart`);
            return null;
        }

        const result = data.chart.result[0];
        const meta = result.meta;
        const quote = result.indicators?.quote?.[0];

        if (!meta || !meta.regularMarketPrice) {
            console.log(`⚠️  Yahoo ${symbol}: No regularMarketPrice`);
            return null;
        }

        const lastPrice = meta.regularMarketPrice;
        const previousClose = meta.chartPreviousClose || meta.previousClose;
        const change = lastPrice - previousClose;
        const changePercent = (change / previousClose) * 100;

        // Obtener OHLC del último dato disponible
        const lastIndex = quote?.close?.length - 1;
        const open = lastIndex >= 0 ? quote.open?.[lastIndex] : null;
        const high = lastIndex >= 0 ? quote.high?.[lastIndex] : null;
        const low = lastIndex >= 0 ? quote.low?.[lastIndex] : null;
        const volume = lastIndex >= 0 ? quote.volume?.[lastIndex] : null;

        const resultData = {
            lastPrice: lastPrice,
            change: change || null,
            changePercent: changePercent || null,
            open: open || null,
            high: high || null,
            low: low || null,
            volume: volume || null,
            previousClose: previousClose || null,
            previousCloseDate: getPreviousMarketDay(),
            marketState: meta.marketState || 'CLOSED',
            currency: meta.currency || 'USD',
            exchange: meta.exchangeName || null,
            regularMarketTime: meta.regularMarketTime
                ? new Date(meta.regularMarketTime * 1000)
                : new Date()
        };

        console.log(`✅ Yahoo ${symbol}: ${resultData.lastPrice} (${resultData.currency})`);
        return resultData;

    } catch (error) {
        console.error(`❌ Yahoo ${symbol} EXCEPTION:`, error.message);
        return null;
    }
}

/**
 * Obtiene datos históricos de Yahoo Finance
 * @param {string} symbol - Símbolo bursátil
 * @param {number} days - Días hacia atrás
 * @returns {Promise<Array>} Array de datos históricos
 */
export async function fetchHistorical(symbol, days = 365) {
    try {
        const endDate = Math.floor(Date.now() / 1000);
        const startDate = endDate - (days * 24 * 60 * 60);

        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${startDate}&period2=${endDate}&interval=1d`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });

        if (!response.ok) {
            return [];
        }

        const data = await response.json();
        const result = data.chart?.result?.[0];

        if (!result) {
            return [];
        }

        const timestamps = result.timestamp || [];
        const quote = result.indicators?.quote?.[0] || {};

        return timestamps.map((timestamp, i) => ({
            date: new Date(timestamp * 1000).toISOString().split('T')[0],
            open: quote.open?.[i] || null,
            high: quote.high?.[i] || null,
            low: quote.low?.[i] || null,
            close: quote.close?.[i] || null,
            volume: quote.volume?.[i] || null,
            adjClose: result.indicators?.adjclose?.[0]?.adjclose?.[i] || null
        })).filter(day => day.close !== null);

    } catch (error) {
        console.error(`❌ Yahoo historical ${symbol}:`, error.message);
        return [];
    }
}

export default { fetchQuote, fetchHistorical };
