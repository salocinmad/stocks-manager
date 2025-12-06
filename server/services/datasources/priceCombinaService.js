/**
 * Servicio de combinación Finnhub + Yahoo
 * Implementa estrategia de complementariedad con prioridad Finnhub
 */

import * as finnhubService from './finnhubService.js';
import * as yahooService from './yahooService.js';
import { getPreviousMarketDay } from '../../utils/dateHelpers.js';
import { getLogLevel } from '../configService.js';

/**
 * Obtiene precio combinando Finnhub (priority) y Yahoo (complement)
 * @param {string} symbol - Símbolo bursátil
 * @returns {Promise<Object|null>} Datos combinados o null
 */
export async function fetchCombinedPrice(symbol) {
    let finnhubData = null;
    let yahooData = null;
    const currentLogLevel = await getLogLevel();

    // 1. Intentar Finnhub primero (solo US)
    try {
        finnhubData = await finnhubService.fetchQuote(symbol);
    } catch (error) {
        if (currentLogLevel === 'verbose') {
            console.log(`⚠️  Finnhub ${symbol}: ${error.message}`);
        }
    }

    // 2. Intentar Yahoo (todos los mercados)
    try {
        yahooData = await yahooService.fetchQuote(symbol);
    } catch (error) {
        if (currentLogLevel === 'verbose') {
            console.error(`❌ Yahoo ${symbol} ERROR:`, error.message);
        }
    }

    // 3. Si ambos fallan, retornar null
    if (!finnhubData && !yahooData) {
        return null;
    }

    // 3. Si ambos fallan, retornar null');

    // 4. Combinar datos (prioridad Finnhub para core, Yahoo para complementar)
    const combined = {
        lastPrice: finnhubData?.lastPrice || yahooData?.lastPrice,
        change: finnhubData?.change ?? yahooData?.change ?? 0,
        changePercent: finnhubData?.changePercent ?? yahooData?.changePercent ?? 0,
        open: yahooData?.open || finnhubData?.open,
        high: yahooData?.high || finnhubData?.high,
        low: yahooData?.low || finnhubData?.low,
        volume: yahooData?.volume || finnhubData?.volume,
        previousClose: finnhubData?.previousClose || yahooData?.previousClose,
        previousCloseDate: yahooData?.previousCloseDate || getPreviousMarketDay(),
        marketState: yahooData?.marketState || 'CLOSED',
        currency: yahooData?.currency || finnhubData?.currency || 'USD',
        exchange: yahooData?.exchange || null,
        regularMarketTime: yahooData?.regularMarketTime || new Date(),
        source: finnhubData && yahooData ? 'finnhub+yahoo' : (finnhubData ? 'finnhub' : 'yahoo')
    };

    if (currentLogLevel === 'verbose') {
        console.log(`✅ ${symbol}: ${combined.lastPrice} (${combined.source})`);
    }

    return combined;
}

export default { fetchCombinedPrice };
