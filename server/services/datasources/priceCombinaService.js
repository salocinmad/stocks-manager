/**
 * Servicio de combinación Finnhub + Yahoo
 * Implementa estrategia de complementariedad con prioridad Finnhub
 */

import * as finnhubService from './finnhubService.js';
import * as yahooService from './yahooService.js';
import { getPreviousMarketDay } from '../../utils/dateHelpers.js';

/**
 * Obtiene precio combinando Finnhub (priority) y Yahoo (complement)
 * @param {string} symbol - Símbolo bursátil
 * @returns {Promise<Object|null>} Datos combinados o null
 */
export async function fetchCombinedPrice(symbol) {
    let finnhubData = null;
    let yahooData = null;

    // 1. Intentar Finnhub primero (solo US)
    try {
        finnhubData = await finnhubService.fetchQuote(symbol);
    } catch (error) {
        console.log(`⚠️  Finnhub ${symbol}: ${error.message}`);
    }

    // 2. Intentar Yahoo (todos los mercados)
    try {
        console.log(`🔍 Intentando Yahoo para ${symbol}...`);
        yahooData = await yahooService.fetchQuote(symbol);
        if (yahooData) {
            console.log(`✅ Yahoo ${symbol}: Datos obtenidos - ${yahooData.lastPrice}`);
        } else {
            console.log(`⚠️  Yahoo ${symbol}: No retornó datos (null)`);
        }
    } catch (error) {
        console.error(`❌ Yahoo ${symbol} ERROR:`, error.message);
    }

    // 3. Si ambos fallan, retornar null
    if (!finnhubData && !yahooData) {
        return null;
    }

    // DEBUG: Mostrar qué datos vienen de cada fuente
    console.log(`📊 ${symbol} - Finnhub data:`, finnhubData ? {
        price: finnhubData.lastPrice,
        change: finnhubData.change,
        changePercent: finnhubData.changePercent
    } : 'null');

    console.log(`📊 ${symbol} - Yahoo data:`, yahooData ? {
        price: yahooData.lastPrice,
        change: yahooData.change,
        changePercent: yahooData.changePercent
    } : 'null');

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

    console.log(`🔀 ${symbol} - Combined:`, {
        price: combined.lastPrice,
        change: combined.change,
        changePercent: combined.changePercent,
        source: combined.source
    });

    return combined;
}

export default { fetchCombinedPrice };
