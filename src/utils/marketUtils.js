
// Determinar número de decimales apropiado para un precio
export const getPriceDecimals = (price) => {
    if (!price || price === 0) return 2;

    // Si el precio es menor a 1, usar 4 decimales
    if (price < 1) {
        return 4;
    }
    // Si el precio es menor a 10, usar 3 decimales
    if (price < 10) {
        return 3;
    }
    // Si el precio es menor a 100, usar 2 decimales
    if (price < 100) {
        return 2;
    }
    // Para precios mayores, usar 2 decimales
    return 2;
};

// Formatear precio con decimales apropiados
export const formatPrice = (price) => {
    if (price === null || price === undefined) return '-';
    const decimals = getPriceDecimals(price);
    return price.toFixed(decimals);
};

// Formatear moneda con símbolo correcto
export const formatCurrency = (value, currencyCode) => {
    if (value === null || value === undefined || isNaN(value)) return '-';
    const formatted = parseFloat(value).toFixed(2);
    const symbol = currencyCode === 'USD' ? '$' : (currencyCode === 'GBP' ? '£' : '€');
    return `${symbol}${formatted}`;
};

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
