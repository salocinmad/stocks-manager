/**
 * Instancia compartida de Yahoo Finance v3
 * En v3 se requiere instanciar explícitamente
 */

import YahooFinance from 'yahoo-finance2';

// Crear instancia para yahoo-finance2 v3
const yahooFinance = new YahooFinance();

export default yahooFinance;
