/**
 * Servicio Yahoo Finance - API de precios y datos históricos
 * Versión 3 - Instanciación directa sin singleton
 */

import YahooFinance from 'yahoo-finance2';
import { getPreviousMarketDay } from '../../utils/dateHelpers.js';

// Crear instancia directamente aquí para cada módulo
const yahooFinance = new YahooFinance();

/**
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
