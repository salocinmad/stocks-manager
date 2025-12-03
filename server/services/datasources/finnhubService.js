/**
 * Servicio Finnhub - API de precios en tiempo real
 * Priority service para mercado americano
 */

import Config from '../../models/Config.js';
import { API_TIMEOUTS } from '../../utils/constants.js';
import { getPreviousMarketDay } from '../../utils/dateHelpers.js';
import { getLogLevel } from '../configService.js';

/**
 * Obtiene quote de Finnhub
 * @param {string} symbol - Símbolo bursátil
 * @returns {Promise<Object|null>} Datos de precio o null
 */
export async function fetchQuote(symbol) {
    const currentLogLevel = await getLogLevel();
    try {
        const apiKey = await Config.findOne({ where: { key: 'finnhub-api-key' } });
        if (!apiKey?.value) {
            if (currentLogLevel === 'verbose') {
                console.log('⚠️  Finnhub API key not configured');
            }
            return null;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), API_TIMEOUTS.FINNHUB);

        const response = await fetch(
            `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey.value}`,
            { signal: controller.signal }
        );

        clearTimeout(timeout);

        if (!response.ok) {
            if (currentLogLevel === 'verbose') {
                console.log(`⚠️  Finnhub ${symbol}: HTTP ${response.status}`);
            }
            return null;
        }

        const data = await response.json();

        // Validar datos
        if (!data.c || data.c <= 0) {
            return null;
        }

        return {
            lastPrice: data.c,           // actual
            change: data.d,              // cambio
            changePercent: data.dp,      // cambio porcentual
            open: data.o,                // apertura
            high: data.h,                // máximo
            low: data.l,                 // mínimo
            previousClose: data.pc,      // cierre anterior
            previousCloseDate: getPreviousMarketDay(),
            // Finnhub no proporciona: volume, marketState, currency, exchange
        };
    } catch (error) {
        if (error.name === 'AbortError') {
            if (currentLogLevel === 'verbose') {
                console.error(`⏱️  Finnhub ${symbol}: Timeout`);
            }
        } else {
            if (currentLogLevel === 'verbose') {
                console.error(`❌ Finnhub ${symbol}:`, error.message);
            }
        }
        return null;
    }
}

export default { fetchQuote };
