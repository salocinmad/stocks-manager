import YahooFinance from 'yahoo-finance2';
import { db } from '../config/database.js';
import * as schema from '../drizzle/schema.js';
import { eq, and } from 'drizzle-orm';
import { getLogLevel } from './configService.js';

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
    // Defaults razonables en caso de que todas las APIs fallen
    const map = { USD: 0.92, EUR: 1.0, GBP: 0.86 };

    try {
        let key = process.env.FINNHUB_API_KEY || '';
        if (!key) {
            const row = await db.query.configs.findFirst({ where: eq(schema.configs.key, 'finnhub-api-key') });
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

    // Fallback Yahoo para USD
    try {
        const eurusd = await yahooFinance.quote('EURUSD=X');
        const r = eurusd?.regularMarketPrice || eurusd?.regularMarketPreviousClose;
        if (r && r > 0) map.USD = 1 / r;
    } catch { }

    // Fallback Yahoo para GBP
    try {
        const eurgbp = await yahooFinance.quote('EURGBP=X');
        const rateGBP = eurgbp?.regularMarketPrice || eurgbp?.regularMarketPreviousClose;
        if (rateGBP && rateGBP > 0) map.GBP = 1 / rateGBP;
    } catch { }

    return map;
};

/**
 * Sobrescribe los datos históricos de DailyPrice para los últimos N días
 * @param {number} days Número de días hacia atrás a actualizar
 */
export const overwriteHistoricalData = async (days = 30) => {
    const currentLogLevel = await getLogLevel(db, eq);
    const results = {
        updatedPositions: 0,
        errors: [],
        details: []
    };

    try {
        if (currentLogLevel === 'verbose') {
            console.log(`🔄 Iniciando sobrescritura de historial para los últimos ${days} días...`);
        }

        // 1. Calcular rango de fechas
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Ajustar a medianoche para comparaciones
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        // 2. Obtener todas las operaciones para identificar posiciones activas
        const operations = await db.select().from(schema.operations);

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

        // Incluir TODAS las posiciones (abiertas y cerradas)
        const allPositions = Array.from(positionsMap.values());
        if (currentLogLevel === 'verbose') {
            console.log(`📍 Encontradas ${allPositions.length} posiciones (activas y cerradas) para actualizar.`);
        }

        // 3. Identificar símbolos únicos para minimizar llamadas a API
        const uniqueSymbols = [...new Set(allPositions.map(p => p.symbol))];
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
                if (currentLogLevel === 'verbose') {
                    console.error(`❌ Error obteniendo historial para ${symbol}:`, err.message);
                }
                results.errors.push(`Error fetch ${symbol}: ${err.message}`);
            }
        }

        // 5. Actualizar DailyPrice para cada posición (activa o cerrada)
        for (const pos of allPositions) {
            const { userId, portfolioId, company, symbol, shares } = pos;
            const positionKey = `${company}|||${symbol}`;
            const cachedData = symbolDataCache.get(symbol);

            if (!cachedData) {
                results.details.push({ position: positionKey, status: 'skipped_no_data' });
                continue;
            }

            const { quotes, currency } = cachedData;
            let exchangeRate = fxMap[currency] || fxMap['GBP'] || 1;

            // Detectar y manejar acciones británicas en pence (.L)
            // Las acciones .L cotizan en peniques (GBp), no libras (GBP)
            // 1 GBP = 100 pence, así que exchangeRate debe dividirse por 100
            // Yahoo puede devolver currency como "GBP" o "GBp"
            if (symbol && symbol.endsWith('.L') && (currency === 'GBP' || currency === 'GBp')) {
                exchangeRate = (fxMap['GBP'] || 0.86) * 0.01;
            }

            let updatedCount = 0;

            for (const quote of quotes) {
                if (!quote.date || !quote.close) continue;

                const dateStr = quote.date.toISOString().split('T')[0];

                // Upsert DailyPrice
                // Buscamos si existe registro para ese día
                const whereClause = and(
                    eq(schema.dailyPrices.userId, userId),
                    eq(schema.dailyPrices.portfolioId, portfolioId),
                    eq(schema.dailyPrices.positionKey, positionKey),
                    eq(schema.dailyPrices.date, dateStr)
                );
                const existingPrice = await db.query.dailyPrices.findFirst({ where: whereClause });

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
                    shares: shares,
                    volume: quote.volume || null,
                    change: 0,
                    changePercent: 0
                };

                if (existingPrice) {
                    await db.update(schema.dailyPrices)
                        .set(priceData)
                        .where(eq(schema.dailyPrices.id, existingPrice.id))
                        .execute();
                } else {
                    await db.insert(schema.dailyPrices).values(priceData).execute();
                }
                updatedCount++;
            }

            results.updatedPositions++;
            results.details.push({ position: positionKey, daysUpdated: updatedCount, status: 'success' });
        }

        // 6. Descargar datos del S&P 500 para comparaciones
        if (currentLogLevel === 'verbose') {
            console.log('📊 Descargando datos del S&P 500 para comparaciones...');
        }
        try {
            const sp500Symbol = '^GSPC';
            const queryOptions = {
                period1: startDate,
                period2: endDate,
                interval: '1d'
            };

            const sp500Data = await yahooFinance.chart(sp500Symbol, queryOptions);

            if (sp500Data && sp500Data.quotes && sp500Data.quotes.length > 0) {
                let sp500UpdatedCount = 0;

                for (const quote of sp500Data.quotes) {
                    if (!quote.date || !quote.close) continue;

                    const dateStr = quote.date.toISOString().split('T')[0];

                    // Guardar en DailyPrice con userId=0, portfolioId=0 (datos globales de mercado)
                    const existingPrice = await db.query.dailyPrices.findFirst({
                        where: and(
                            eq(schema.dailyPrices.userId, 0),
                            eq(schema.dailyPrices.portfolioId, 0),
                            eq(schema.dailyPrices.positionKey, 'S&P 500|||^GSPC'),
                            eq(schema.dailyPrices.date, dateStr)
                        )
                    });

                    const priceData = {
                        userId: 0,
                        portfolioId: 0,
                        positionKey: 'S&P 500|||^GSPC',
                        company: 'S&P 500',
                        symbol: sp500Symbol,
                        date: dateStr,
                        close: quote.close,
                        open: quote.open || quote.close,
                        high: quote.high || quote.close,
                        low: quote.low || quote.close,
                        volume: quote.volume || null,
                        currency: 'USD',
                        exchangeRate: fxMap['USD'] || 1,
                        source: 'yahoo_sp500_index',
                        shares: 0,
                        change: 0,
                        changePercent: 0
                    };

                    if (existingPrice) {
                        await db.update(schema.dailyPrices)
                            .set(priceData)
                            .where(eq(schema.dailyPrices.id, existingPrice.id));
                    } else {
                        await db.insert(schema.dailyPrices).values(priceData);
                    }
                    sp500UpdatedCount++;
                }

                results.details.push({ position: 'S&P 500', daysUpdated: sp500UpdatedCount, status: 'success' });
                if (currentLogLevel === 'verbose') {
                    console.log(`✅ S&P 500: ${sp500UpdatedCount} días actualizados`);
                }
            }
        } catch (err) {
            if (currentLogLevel === 'verbose') {
                console.error('❌ Error descargando S&P 500:', err.message);
            }
            results.errors.push(`Error S&P 500: ${err.message}`);
        }

        if (currentLogLevel === 'verbose') {
            console.log(`✅ Sobrescritura completada. Posiciones actualizadas: ${results.updatedPositions}`);
        }
        return results;

    } catch (error) {
        if (currentLogLevel === 'verbose') {
            console.error('❌ Error crítico en overwriteHistoricalData:', error);
        }
        throw error;
    }
};

export { overwriteHistoricalData };
