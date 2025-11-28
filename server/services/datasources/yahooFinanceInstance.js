/**
 * Instancia compartida de Yahoo Finance
 * Configuración centralizada con rate limiting
 */

import yahooFinance from 'yahoo-finance2';

// Configurar yahoo-finance2 v3
yahooFinance.setGlobalConfig({
    queue: {
        concurrency: 1,  // 1 request a la vez (evitar rate limiting)
        timeout: 300000   // 5 minutos timeout
    },
    validation: {
        logErrors: true
    }
});

export default yahooFinance;
