/**
 * Servicio de combinación Finnhub + Yahoo
 * Implementa estrategia de complementariedad con prioridad Finnhub
 */

import * as finnhubService from './finnhubService.js';
import * as yahooService from './yahooService.js';
import { isUSSymbol } from '../../utils/symbolHelpers.js';
import { DATA_SOURCES } from '../../utils/constants.js';

/**
 * Obtiene precio combinando Finnhub (priority) y Yahoo (complement)
 * @param {string} symbol - Símbolo bursátil
 * @returns {Promise<Object|null>} Datos combinados o null
 */
export async function fetchCombinedPrice(symbol) {
    const isUS = isUSSymbol(symbol);

    let finnhubData = null;
    let yahooData = null;
    let source = '';

    // 1. Intentar Finnhub si es US
    if (isUS) {
        finnhubData = await finnhubService.fetchQuote(symbol);
    }

    // 2. SIEMPRE intentar Yahoo (para complementar o como principal)
    yahooData = await yahooService.fetchQuote(symbol);

    // 3. Determinar source
    if (finnhubData && yahooData) {
        source = DATA_SOURCES.COMBINED;
    } else if (finnhubData) {
        source = DATA_SOURCES.FINNHUB;
    } else if (yahooData) {
        source = DATA_SOURCES.YAHOO;
    } else {
        return null;
    }

    // 4. COMBINAR con prioridad Finnhub
    const combined = {
        // Precio actual (FINNHUB priority)
        lastPrice: finnhubData?.lastPrice || yahooData?.lastPrice,
        change: finnhubData?.change || yahooData?.change,
        changePercent: finnhubData?.changePercent || yahooData?.changePercent,

        // OHLC (FINNHUB priority)
        open: finnhubData?.open || yahooData?.open,
        high: finnhubData?.high || yahooData?.high,
        low: finnhubData?.low || yahooData?.low,

        // Cierre anterior (FINNHUB priority)
        previousClose: finnhubData?.previousClose || yahooData?.previousClose,
        previousCloseDate: finnhubData?.previousCloseDate || yahooData?.previousCloseDate,

        // Datos adicionales (YAHOO complementa)
        volume: yahooData?.volume || null,
        marketState: yahooData?.marketState || 'CLOSED',
        currency: yahooData?.currency || 'USD',
        exchange: yahooData?.exchange || null,
        regularMarketTime: yahooData?.regularMarketTime || new Date(),

        // Metadata
        source,
        updatedAt: new Date()
    };

    // 5. Calcular change/changePercent si faltan
    if (!combined.change && combined.lastPrice && combined.previousClose) {
        combined.change = combined.lastPrice - combined.previousClose;
    }

    if (!combined.changePercent && combined.change !== null && combined.previousClose > 0) {
        combined.changePercent = (combined.change / combined.previousClose) * 100;
    }

    return combined;
}

export default { fetchCombinedPrice };
