/**
 * Constantes globales del sistema
 * Centraliza configuraciones para facilitar mantenimiento
 */

// Tasas de cambio por defecto (fallback)
export const DEFAULT_EXCHANGE_RATES = {
    USD: 0.92,  // USD a EUR
    EUR: 1.0,
    GBP: 1.17,  // GBP a EUR
};

// Horarios de mercado (UTC)
export const MARKET_HOURS = {
    US: {
        open: '14:30',   // 9:30 AM EST
        close: '21:00',  // 4:00 PM EST
    },
    EU: {
        open: '08:00',   // 9:00 AM CET
        close: '16:30',  // 5:30 PM CET
    },
};

// Timeouts de APIs (milisegundos)
export const API_TIMEOUTS = {
    FINNHUB: 5000,
    YAHOO: 10000,
    EXCHANGE_RATE: 3000,
};

// Límites de rate limiting
export const RATE_LIMITS = {
    FINNHUB_PER_MINUTE: 60,
    YAHOO_PER_HOUR: 2000,
};

// Intervalos de scheduler (minutos)
export const SCHEDULER_INTERVALS = {
    PRICE_UPDATE: 15,
    DAILY_CLOSE: 1440,  // 24 horas
};

// Configuración de históricos
export const HISTORICAL_CONFIG = {
    DEFAULT_DAYS: 365,
    MAX_DAYS: 3650,  // 10 años
    GAP_THRESHOLD: 0.7,  // 70% de días esperados
};

// Sufijos de mercados
export const MARKET_SUFFIXES = {
    MADRID: '.MC',
    FRANKFURT: '.F',
    LONDON: '.L',
    PARIS: '.PA',
    NASDAQ: '',  // Sin sufijo
};

// Monedas por mercado
export const MARKET_CURRENCIES = {
    '.MC': 'EUR',
    '.F': 'EUR',
    '.L': 'GBP',
    '.PA': 'EUR',
    'DEFAULT': 'USD',
};

// Estados de mercado
export const MARKET_STATES = {
    PRE: 'PRE',
    OPEN: 'OPEN',
    CLOSED: 'CLOSED',
    POST: 'POST',
};

// Tipos de fuentes de datos
export const DATA_SOURCES = {
    FINNHUB: 'finnhub',
    YAHOO: 'yahoo',
    COMBINED: 'finnhub+yahoo',
    MANUAL: 'manual',
};

export default {
    DEFAULT_EXCHANGE_RATES,
    MARKET_HOURS,
    API_TIMEOUTS,
    RATE_LIMITS,
    SCHEDULER_INTERVALS,
    HISTORICAL_CONFIG,
    MARKET_SUFFIXES,
    MARKET_CURRENCIES,
    MARKET_STATES,
    DATA_SOURCES,
};
