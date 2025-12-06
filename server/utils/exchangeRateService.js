/**
 * Servicio de tipos de cambio
 * Obtiene tasas de conversión EUR/USD/GBP
 */

import { DEFAULT_EXCHANGE_RATES, MARKET_CURRENCIES } from './constants.js';

/**
 * Obtiene tipo de cambio actual para una moneda
 * TODO: Integrar con API real de tipos de cambio (ej: ECB, Open Exchange Rates)
 * Por ahora usa valores por defecto
 * 
 * @param {string} currency - Código de moneda ('USD', 'EUR', 'GBP')
 * @returns {Promise<number>} Tipo de cambio a EUR
 */
export async function getExchangeRate(currency) {
    if (!currency) return 1;

    const normalized = currency.toUpperCase();

    // EUR siempre es 1
    if (normalized === 'EUR') return 1;

    // POR HACER: Implementar llamada a API real
    // Por ahora, retornar valores por defecto
    return DEFAULT_EXCHANGE_RATES[normalized] || 1;
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
    getExchangeRate,
    convertToEUR,
    convertFromEUR,
    detectCurrencyFromSymbol,
    formatCurrency,
    calculateWeightedExchangeRate,
};
