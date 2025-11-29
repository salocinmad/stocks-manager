import YahooFinance from 'yahoo-finance2';
import DailyPrice from '../models/DailyPrice.js';
import Operation from '../models/Operation.js';
import Portfolio from '../models/Portfolio.js';
import Config from '../models/Config.js';
import { Op } from 'sequelize';

// Instancia de Yahoo Finance
const yahooFinance = new YahooFinance({
    suppressNotices: ['yahooSurvey'],
    queue: {
        concurrency: 1,
        timeout: 10000 // Aumentar timeout para operaciones batch
    }
});

/**
 * Obtiene el mapa de tipos de cambio a EUR
 */
const getFxMapToEUR = async () => {
    const map = { USD: 1, EUR: 1, GBP: 1 };
    try {
        let key = process.env.FINNHUB_API_KEY || '';
        if (!key) {
            const row = await Config.findOne({ where: { key: 'finnhub-api-key' } });
            key = row?.value || '';
        }
        if (key) {
            const r1 = await fetch(`https://finnhub.io/api/v1/forex/rates?base=EUR&token=${encodeURIComponent(key)}`);
            if (r1.ok) {
                const data = await r1.json();
                const usdPerEur = Number(data?.rates?.USD);
                const gbpPerEur = Number(data?.rates?.GBP);
                if (usdPerEur && usdPerEur > 0) map.USD = 1 / usdPerEur;
                if (gbpPerEur && gbpPerEur > 0) map.GBP = 1 / gbpPerEur;
                return map;
            }
        }
    } catch { }

    // Fallback Yahoo
    try {
        const eurusd = await yahooFinance.quote('EURUSD=X');
        const r = eurusd?.regularMarketPrice || eurusd?.regularMarketPreviousClose;
        if (r && r > 0) map.USD = 1 / r;
    } catch { }

    return map;
};

/**
 * Sobrescribe los datos históricos de DailyPrice para los últimos N días
 * @param {number} days Número de días hacia atrás a actualizar
 */
export const overwriteHistoricalData = async (days = 30) => {
    const results = {
        updatedPositions: 0,
        errors: [],
        details: []
    };

    try {
        console.log(`🔄 Iniciando sobrescritura de historial para los últimos ${days} días...`);

        // 1. Calcular rango de fechas
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Ajustar a medianoche para comparaciones
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        // 2. Obtener todas las operaciones para identificar posiciones activas
        const operations = await Operation.findAll();

        // Agrupar operaciones por Usuario + Portafolio + Símbolo
        // Map key: "userId:portfolioId:company:symbol"
        const positionsMap = new Map();

        for (const op of operations) {
            if (!op.symbol) continue; // Ignorar operaciones sin símbolo (manuales puras sin tracking)

            const key = `${op.userId}:${op.portfolioId}:${op.company}:${op.symbol}`;

            if (!positionsMap.has(key)) {
                positionsMap.set(key, {
                    userId: op.userId,
                    portfolioId: op.portfolioId,
                    company: op.company,
                    symbol: op.symbol,
                    shares: 0
                });
            }

            const pos = positionsMap.get(key);
            if (op.type === 'purchase') {
                pos.shares += op.shares;
            } else if (op.type === 'sale') {
                pos.shares -= op.shares;
            }
        }

        // Filtrar solo posiciones activas (shares > 0)
        const activePositions = Array.from(positionsMap.values()).filter(p => p.shares > 0);
        console.log(`📍 Encontradas ${activePositions.length} posiciones activas para actualizar.`);

        // 3. Identificar símbolos únicos para minimizar llamadas a API
        const uniqueSymbols = [...new Set(activePositions.map(p => p.symbol))];
        const symbolDataCache = new Map();
        const fxMap = await getFxMapToEUR();

        // 4. Fetch datos históricos para cada símbolo único
        for (const symbol of uniqueSymbols) {
            try {
                const ySymbol = String(symbol).replace(/[:\-]/g, '.');
                const queryOptions = {
                    period1: startDate,
                    period2: endDate,
                    interval: '1d'
                };

                const chartData = await yahooFinance.chart(ySymbol, queryOptions);

                if (chartData && chartData.quotes && chartData.quotes.length > 0) {
                    symbolDataCache.set(symbol, {
                        quotes: chartData.quotes,
                        currency: chartData.meta?.currency || 'EUR'
                    });
                }
            } catch (err) {
                console.error(`❌ Error obteniendo historial para ${symbol}:`, err.message);
                results.errors.push(`Error fetch ${symbol}: ${err.message}`);
            }
        }

        // 5. Actualizar DailyPrice para cada posición activa
        for (const pos of activePositions) {
            const { userId, portfolioId, company, symbol, shares } = pos;
            const positionKey = `${company}|||${symbol}`;
            const cachedData = symbolDataCache.get(symbol);

            if (!cachedData) {
                results.details.push({ position: positionKey, status: 'skipped_no_data' });
                continue;
            }

            const { quotes, currency } = cachedData;
            const exchangeRate = fxMap[currency] || 1;

            let updatedCount = 0;

            for (const quote of quotes) {
                if (!quote.date || !quote.close) continue;

                const dateStr = quote.date.toISOString().split('T')[0];

                // Upsert DailyPrice
                // Buscamos si existe registro para ese día
                const existingPrice = await DailyPrice.findOne({
                    where: {
                        userId,
                        portfolioId,
                        positionKey,
                        date: dateStr
                    }
                });

                const priceData = {
                    userId,
                    portfolioId,
                    positionKey,
                    company,
                    symbol,
                    date: dateStr,
                    close: quote.close,
                    open: quote.open || quote.close,
                    high: quote.high || quote.close,
                    low: quote.low || quote.close,
                    currency,
                    exchangeRate,
                    source: 'yahoo_history_overwrite',
                    shares: shares, // Usamos shares actuales (aproximación aceptable para historial reciente)
                    change: 0, // No calculamos change diario en batch histórico simple
                    changePercent: 0
                };

                if (existingPrice) {
                    await existingPrice.update(priceData);
                } else {
                    await DailyPrice.create(priceData);
                }
                updatedCount++;
            }

            results.updatedPositions++;
            results.details.push({ position: positionKey, daysUpdated: updatedCount, status: 'success' });
        }

        console.log(`✅ Sobrescritura completada. Posiciones actualizadas: ${results.updatedPositions}`);
        return results;

    } catch (error) {
        console.error('❌ Error crítico en overwriteHistoricalData:', error);
        throw error;
    }
};

export default { overwriteHistoricalData };
