/**
 * Servicio Yahoo Finance - API de precios y datos históricos
 * Complementa Finnhub y proporciona historical data
 */

import yahooFinance from './yahooFinanceInstance.js';
import { getPreviousMarketDay } from '../../utils/dateHelpers.js';

/**
 * Obtiene quote de Yahoo Finance
 * @param {string} symbol - Símbolo bursátil
 * @returns {Promise<Object|null>} Datos de precio o null
 */
export async function fetchQuote(symbol) {
    try {
        const quote = await yahooFinance.quote(symbol);

        const price = quote.regularMarketPrice || quote.postMarketPrice || quote.preMarketPrice;
        if (!price || price <= 0) {
            return null;
        }

        return {
            lastPrice: price,
            change: quote.regularMarketChange,
            changePercent: quote.regularMarketChangePercent,
            open: quote.regularMarketOpen,
            high: quote.regularMarketDayHigh,
            low: quote.regularMarketDayLow,
            volume: quote.regularMarketVolume,
            previousClose: quote.regularMarketPreviousClose || quote.previousClose,
            previousCloseDate: getPreviousMarketDay(),
            marketState: quote.marketState || 'CLOSED',
            currency: quote.currency,
            exchange: quote.fullExchangeName,
            regularMarketTime: quote.regularMarketTime
                ? new Date(quote.regularMarketTime * 1000)
                : new Date()
        };
    } catch (error) {
        console.error(`❌ Yahoo ${symbol}:`, error.message);
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
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const historical = await yahooFinance.historical(symbol, {
            period1: startDate.toISOString().split('T')[0],
            period2: endDate.toISOString().split('T')[0],
            interval: '1d'
        });

        return historical.map(day => ({
            date: day.date.toISOString().split('T')[0],
            open: day.open,
            high: day.high,
            low: day.low,
            close: day.close,
            volume: day.volume,
            adjClose: day.adjClose
        }));
    } catch (error) {
        console.error(`❌ Yahoo historical ${symbol}:`, error.message);
        return [];
    }
}

export default { fetchQuote, fetchHistorical };
