/**
 * Servicio de tipos de cambio
 * Obtiene tasas de conversión EUR/USD/GBP
 */

import { DEFAULT_EXCHANGE_RATES, MARKET_CURRENCIES } from './constants.js';
import YahooFinance from 'yahoo-finance2';
import Config from '../models/Config.js';

const yahooFinance = new YahooFinance({
    suppressNotices: ['yahooSurvey'],
});

/**
 * Obtiene un mapa de tipos de cambio (EUR como base)
 * @returns {Promise<Object>} Mapa { USD: rate, GBP: rate, ... }
 */
export async function getFxMapToEUR() {
    const map = { ...DEFAULT_EXCHANGE_RATES };

    // 1. Intentar con Finnhub si hay API key
    try {
        let key = process.env.FINNHUB_API_KEY || '';
        if (!key) {
            const row = await Config.findOne({ where: { key: 'finnhub-api-key' } });
            key = row?.value || '';
        }

        if (key) {
            const response = await fetch(`https://finnhub.io/api/v1/forex/rates?base=EUR&token=${encodeURIComponent(key)}`);
            if (response.ok) {
                const data = await response.json();
                if (data && data.rates) {
                    const usdPerEur = Number(data.rates.USD);
                    const gbpPerEur = Number(data.rates.GBP);
                    if (usdPerEur && usdPerEur > 0) map.USD = 1 / usdPerEur;
                    if (gbpPerEur && gbpPerEur > 0) map.GBP = 1 / gbpPerEur;
                    return map;
                }
            }
        }
    } catch (e) {
        // Silencioso, intentar fallback
    }

    // 2. Fallback Yahoo Finance
    try {
        const symbols = ['EURUSD=X', 'EURGBP=X'];
        const quotes = await yahooFinance.quote(symbols);

        const usdQuote = quotes.find(q => q.symbol === 'EURUSD=X');
        if (usdQuote) {
            const r = usdQuote.regularMarketPrice || usdQuote.regularMarketPreviousClose;
            if (r && r > 0) map.USD = 1 / r;
        }

        const gbpQuote = quotes.find(q => q.symbol === 'EURGBP=X');
        if (gbpQuote) {
            const r = gbpQuote.regularMarketPrice || gbpQuote.regularMarketPreviousClose;
            if (r && r > 0) map.GBP = 1 / r;
        }
    } catch (e) {
        // Usar defaults si todo falla
    }

    return map;
}

/**
 * Obtiene tipo de cambio actual para una moneda
 * @param {string} currency - Código de moneda ('USD', 'EUR', 'GBP')
 * @returns {Promise<number>} Tipo de cambio a EUR
 */
export async function getExchangeRate(currency) {
    if (!currency) return 1;

    const normalized = currency.toUpperCase();
    if (normalized === 'EUR') return 1;

    const map = await getFxMapToEUR();
    return map[normalized] || 1;
}

/**
 * Convierte monto a EUR
 * @param {number} amount - Cantidad a convertir
 * @param {string} currency - Moneda origen
 * @returns {Promise<number>} Monto en EUR
 */
export async function convertToEUR(amount, currency) {
    const rate = await getExchangeRate(currency);
    return amount * rate;
}

/**
 * Convierte de EUR a otra moneda
 * @param {number} amountEUR - Cantidad en EUR
 * @param {string} targetCurrency - Moneda destino
 * @returns {Promise<number>} Monto en moneda destino
 */
export async function convertFromEUR(amountEUR, targetCurrency) {
    const rate = await getExchangeRate(targetCurrency);
    if (rate === 0) return 0;
    return amountEUR / rate;
}

/**
 * Detecta moneda basada en símbolo de mercado
 * @param {string} symbol - Símbolo bursátil
 * @returns {string} Código de moneda
 */
export function detectCurrencyFromSymbol(symbol) {
    if (!symbol) return 'USD';

    for (const [suffix, currency] of Object.entries(MARKET_CURRENCIES)) {
        if (suffix === 'DEFAULT') continue;
        if (symbol.endsWith(suffix)) {
            return currency;
        }
    }

    return MARKET_CURRENCIES.DEFAULT;
}

/**
 * Formatea cantidad con símbolo de moneda
 * @param {number} amount - Cantidad
 * @param {string} currency - Código de moneda
 * @returns {string} Cantidad formateada (ej: "1,234.56 €")
 */
export function formatCurrency(amount, currency = 'EUR') {
    const symbols = {
        EUR: '€',
        USD: '$',
        GBP: '£',
    };

    const formatted = new Intl.NumberFormat('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);

    const symbol = symbols[currency] || currency;

    return currency === 'USD' ? `${symbol}${formatted}` : `${formatted} ${symbol}`;
}

/**
 * Calcula tipo de cambio ponderado de operaciones
 * @param {Array} operations - Array de operaciones con shares y exchangeRate
 * @returns {number} Tipo de cambio ponderado
 */
export function calculateWeightedExchangeRate(operations) {
    if (!operations || operations.length === 0) return 1;

    let totalShares = 0;
    let totalWeighted = 0;

    operations.forEach(op => {
        const shares = op.shares || 0;
        const rate = op.exchangeRate || 1;

        totalShares += shares;
        totalWeighted += shares * rate;
    });

    return totalShares > 0 ? totalWeighted / totalShares : 1;
}

export default {
    getFxMapToEUR,
    getExchangeRate,
    convertToEUR,
    convertFromEUR,
    detectCurrencyFromSymbol,
    formatCurrency,
    calculateWeightedExchangeRate,
};

