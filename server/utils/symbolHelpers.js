/**
 * Utilidades para manejo de símbolos y positionKeys
 * Funciones puras para validación y transformación
 */

import { MARKET_SUFFIXES } from './constants.js';

/**
 * Crea positionKey a partir de company y symbol
 * @param {string} company - Nombre de la compañía
 * @param {string} symbol - Símbolo bursátil
 * @returns {string} positionKey en formato 'company|||symbol'
 */
export function createPositionKey(company, symbol) {
    return symbol ? `${company}|||${symbol}` : company;
}

/**
 * Parsea positionKey en sus componentes
 * @param {string} positionKey - positionKey a parsear
 * @returns {{company: string, symbol: string}} Componentes
 */
export function parsePositionKey(positionKey) {
    const parts = positionKey.split('|||');
    return {
        company: parts[0] || '',
        symbol: parts[1] || '',
    };
}

/**
 * Extrae símbolo de positionKey
 * @param {string} positionKey - positionKey
 * @returns {string} Símbolo o string vacío
 */
export function getSymbolFromPositionKey(positionKey) {
    const parts = positionKey.split('|||');
    return parts[1] || '';
}

/**
 * Detecta si un símbolo es del mercado americano
 * @param {string} symbol - Símbolo a verificar
 * @returns {boolean} true si es símbolo US
 */
export function isUSSymbol(symbol) {
    if (!symbol) return false;

    // Símbolos US: sin sufijo o con .US
    const hasNoSuffix = !symbol.includes('.');
    const hasUSSuffix = symbol.endsWith('.US');

    return hasNoSuffix || hasUSSuffix;
}

/**
 * Detecta mercado de un símbolo
 * @param {string} symbol - Símbolo bursátil
 * @returns {string} Mercado ('US', 'EU', 'UK', 'UNKNOWN')
 */
export function detectMarket(symbol) {
    if (!symbol) return 'UNKNOWN';

    if (symbol.endsWith(MARKET_SUFFIXES.MADRID) || symbol.endsWith(MARKET_SUFFIXES.FRANKFURT) || symbol.endsWith(MARKET_SUFFIXES.PARIS)) {
        return 'EU';
    }

    if (symbol.endsWith(MARKET_SUFFIXES.LONDON)) {
        return 'UK';
    }

    if (isUSSymbol(symbol)) {
        return 'US';
    }

    return 'UNKNOWN';
}

/**
 * Valida formato de símbolo
 * @param {string} symbol - Símbolo a validar
 * @returns {boolean} true si es válido
 */
export function isValidSymbol(symbol) {
    if (!symbol || typeof symbol !== 'string') return false;

    // Mínimo 1 carácter, máximo 10
    if (symbol.length < 1 || symbol.length > 10) return false;

    // Solo letras, números, punto y guión
    const validPattern = /^[A-Z0-9.-]+$/i;
    return validPattern.test(symbol);
}

/**
 * Normaliza símbolo (uppercase, trim)
 * @param {string} symbol - Símbolo a normalizar
 * @returns {string} Símbolo normalizado
 */
export function normalizeSymbol(symbol) {
    if (!symbol) return '';
    return symbol.trim().toUpperCase();
}

/**
 * Obtiene lista de símbolos únicos de array de operations
 * @param {Array} operations - Array de operaciones
 * @returns {Array<string>} Array de símbolos únicos
 */
export function getUniqueSymbols(operations) {
    const symbols = operations
        .map(op => op.symbol)
        .filter(symbol => symbol && symbol.trim() !== '');

    return [...new Set(symbols)];
}

/**
 * Convierte símbolo a formato Yahoo Finance
 * @param {string} symbol - Símbolo original
 * @returns {string} Símbolo en formato Yahoo
 */
export function toYahooFormat(symbol) {
    // Yahoo usa formatos específicos para algunos mercados
    // Ej: Madrid usa .MC, Frankfurt .F, etc.
    // Esta función puede expandirse según necesidad
    return normalizeSymbol(symbol);
}

/**
 * Convierte símbolo a formato Finnhub
 * @param {string} symbol - Símbolo original
 * @returns {string} Símbolo en formato Finnhub
 */
export function toFinnhubFormat(symbol) {
    // Finnhub puede tener formatos diferentes
    // Por ahora, normalizamos
    return normalizeSymbol(symbol);
}

export default {
    createPositionKey,
    parsePositionKey,
    getSymbolFromPositionKey,
    isUSSymbol,
    detectMarket,
    isValidSymbol,
    normalizeSymbol,
    getUniqueSymbols,
    toYahooFormat,
    toFinnhubFormat,
};
