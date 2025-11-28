/**
 * Instancia compartida de Yahoo Finance v3
 * En v3, no se usa setGlobalConfig, se exporta directamente
 */

import yahooFinance from 'yahoo-finance2';

// yahoo-finance2 v3 maneja configuración internamente
// No necesitamos setGlobalConfig, funciona out-of-the-box
export default yahooFinance;
