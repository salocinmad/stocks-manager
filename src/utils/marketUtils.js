
import { getPriceDecimals, formatPrice, formatCurrency } from './formatters.js';

export { getPriceDecimals, formatPrice, formatCurrency };

// Mapear exchanges para Yahoo Finance
export const mapExchangeToYahoo = (exchange) => {
    const exchangeMap = {
        'MC': 'MC',       // Bolsa de Madrid - Yahoo usa MC
        'BME': 'MC',      // Bolsa de Madrid - convertir BME a MC para Yahoo
        'NASDAQ': '',     // NASDAQ en Yahoo no necesita sufijo para la mayoría
        'NYSE': '',       // NYSE en Yahoo no necesita sufijo para la mayoría
        'FRA': 'F',       // Frankfurt - Yahoo usa .F (ej: AMD.F)
        'XETR': 'DE',     // XETRA
        'LON': 'L',       // London
        'TSE': 'T',       // Tokyo
        'AMEX': 'AMEX'
    };
    return exchangeMap[exchange.toUpperCase()] !== undefined ? exchangeMap[exchange.toUpperCase()] : exchange;
};

// Determinar moneda basándose en el exchange
export const getCurrencyFromExchange = (symbol) => {
    if (!symbol || !symbol.includes(':')) {
        // Si no hay exchange, asumir USD por defecto (NASDAQ/NYSE)
        return 'USD';
    }

    const parts = symbol.split(':');
    const exchange = parts[1].toUpperCase();

    // Exchanges europeos que usan EUR
    const eurExchanges = ['MC', 'BME', 'FRA', 'XETR', 'DE', 'LON', 'L', 'AMS', 'PAR', 'BRU', 'MIL', 'LIS'];

    if (eurExchanges.includes(exchange)) {
        return 'EUR';
    }

    // Exchanges que usan USD
    const usdExchanges = ['NASDAQ', 'NYSE', 'AMEX'];
    if (usdExchanges.includes(exchange)) {
        return 'USD';
    }

    // Por defecto, asumir USD si no se reconoce
    return 'USD';
};
