/**
 * Servicio Yahoo Finance - API de precios y datos históricos
 * Versión 3 - Instanciación directa sin singleton
 */

import YahooFinance from 'yahoo-finance2';
import { getPreviousMarketDay } from '../../utils/dateHelpers.js';

// Crear instancia directamente aquí para cada módulo
const yahooFinance = new YahooFinance();

/**
 * Obtiene quote de Yahoo Finance
 * @param {string} symbol - Símbolo bursátil
 * @returns {Promise<Object|null>} Datos de precio o null
 */
export async function fetchQuote(symbol) {
    try {
        const quote = await yahooFinance.quote(symbol);

        // Verificar que el quote existe y tiene datos válidos
        if (!quote) {
            return null;
        }

        const price = quote.regularMarketPrice || quote.postMarketPrice || quote.preMarketPrice;
        if (!price || price <= 0) {
            return null;
        }

        // Manejar regularMarketTime correctamente (viene en milisegundos en v3)
        let marketTime = new Date();
        if (quote.regularMarketTime) {
            // En v3, regularMarketTime ya es Date o timestamp en milisegundos
            if (typeof quote.regularMarketTime === 'number') {
                // Si es mayor a timestamp en segundos (año 2000+), asumir milisegundos
                marketTime = quote.regularMarketTime > 946684800000
                    ? new Date(quote.regularMarketTime)
                    : new Date(quote.regularMarketTime * 1000);
            } else if (quote.regularMarketTime instanceof Date) {
                marketTime = quote.regularMarketTime;
            }

            // Validar que la fecha sea razonable (entre 1990 y 2100)
            if (marketTime.getFullYear() < 1990 || marketTime.getFullYear() > 2100) {
                marketTime = new Date();
            }
        }

        return {
            lastPrice: price,
            change: quote.regularMarketChange || null,
            changePercent: quote.regularMarketChangePercent || null,
            open: quote.regularMarketOpen || null,
            high: quote.regularMarketDayHigh || null,
            low: quote.regularMarketDayLow || null,
            volume: quote.regularMarketVolume || null,
            previousClose: quote.regularMarketPreviousClose || quote.previousClose || null,
            previousCloseDate: getPreviousMarketDay(),
            marketState: quote.marketState || 'CLOSED',
            currency: quote.currency || 'USD',
            exchange: quote.fullExchangeName || null,
            regularMarketTime: marketTime
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
