import { Op } from 'sequelize';
import Operation from '../models/Operation.js';
import DailyPortfolioStats from '../models/DailyPortfolioStats.js';
import PriceCache from '../models/PriceCache.js';
import Portfolio from '../models/Portfolio.js';
import AssetProfile from '../models/AssetProfile.js';
import PortfolioReport from '../models/PortfolioReport.js';
import DailyPrice from '../models/DailyPrice.js';
import {
    calculateROI,
    calculateWinRate,
    calculateAverageHoldingTime,
    calculateMonthlyGrowth,
    calculateMonthlyGains,
    findBestWorstMonth,
    calculateDailyChange,
    calculateConcentrationIndex
} from '../utils/metricsCalculator.js';
import {
    calculateActivePositions,
    calculateClosedOperations,
    transformDailyStatsToChartData,
    getTopPositions,
    calculateContributionByCompany,
    transformHistoricalPricesToChartData
} from '../utils/dataAggregator.js';
import { generateAlerts } from './alertsService.js';
import { fetchHistorical } from './datasources/yahooService.js';
import { getLogLevel } from '../services/configService.js';
import { calculateMonthlyAnalysis, calculateRealizedPnLByMonth } from './pnlService.js';

/**
 * Servicio para generar reportes completos del portafolio
 * Orquesta el cálculo de todas las métricas
 */

/**
 * Genera un reporte diario completo para un portafolio
 * @param {number} userId - ID del usuario
 * @param {number} portfolioId - ID del portafolio
 * @param {string} date - Fecha del reporte (YYYY-MM-DD)
 * @param {number} currentEURUSD - Tipo de cambio EUR/USD actual
 * @returns {Object} Reporte generado
 */
export async function generateDailyReport(userId, portfolioId, date, currentEURUSD = null) {
    const currentLogLevel = await getLogLevel();
    try {
        // 1. Obtener operaciones del portafolio
        const operations = await Operation.findAll({
            where: { userId, portfolioId },
            order: [['date', 'ASC']]
        });

        if (operations.length === 0) {
            if (currentLogLevel === 'verbose') {
                console.log(`No operations found for portfolio ${portfolioId}`);
            }
            return null;
        }

        // 2. Calcular posiciones activas y cerradas
        const activePositions = calculateActivePositions(operations);
        const closedOperations = calculateClosedOperations(operations);

        // 2.1. Obtener datos históricos de precios para el último año para cada posición activa
        const oneYearAgo = new Date(date);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const historicalPrices = {};
        const historicalChartData = {};

        if (currentLogLevel === 'verbose') {
            console.log('Active Positions (count):', Object.keys(activePositions).length);
        }

        for (const positionKey in activePositions) {
            const position = activePositions[positionKey];

            // Verificar si tenemos datos históricos suficientes en la DB
            const existingDailyPrices = await DailyPrice.findAll({
                where: {
                    userId,
                    portfolioId,
                    positionKey: position.positionKey,
                    date: {
                        [Op.gte]: oneYearAgo.toISOString().split('T')[0],
                        [Op.lte]: date
                    }
                },
                order: [['date', 'ASC']]
            });

            if (currentLogLevel === 'verbose') {
                console.log(`📊 existingDailyPrices.length for ${position.positionKey}: ${existingDailyPrices.length}`);
            }
            // Si no hay suficientes datos (menos de 365 días), obtener de Yahoo Finance
            if (existingDailyPrices.length < 365) {
                if (currentLogLevel === 'verbose') {
                    console.log(`✅ Entrando al bloque de obtención de datos históricos de Yahoo Finance para ${position.positionKey}.`);
                    console.log(`⏳ Obteniendo datos históricos de Yahoo Finance para ${position.positionKey}...`);
                    console.log(`DEBUG: existingDailyPrices.length es ${existingDailyPrices.length}, se intentará obtener de Yahoo Finance.`);
                }
                if (currentLogLevel === 'verbose') {
                    console.error(`ERROR_DEBUG: Entrando al bloque de obtención de datos históricos de Yahoo Finance para ${position.positionKey}.`);
                }
                let yahooHistoricalData = [];
                try {
                    yahooHistoricalData = await fetchHistorical(position.positionKey, 365);
                    if (currentLogLevel === 'verbose') {
                        console.log(`🔍 Yahoo Historical Data length for ${position.positionKey}: ${yahooHistoricalData.length}`);
                    }
                } catch (error) {
                    if (currentLogLevel === 'verbose') {
                        console.error(`❌ Error al obtener datos históricos de Yahoo Finance para ${position.positionKey}:`, error.message);
                    }
                }

                if (yahooHistoricalData.length > 0) {
                    // Guardar los datos obtenidos de Yahoo Finance en DailyPrice
                    const dailyPriceRecords = yahooHistoricalData.map(data => ({
                        userId,
                        portfolioId,
                        positionKey: position.positionKey,
                        company: position.positionKey.split('|||')[0],
                        date: data.date,
                        open: data.open,
                        high: data.high,
                        low: data.low,
                        close: data.close,
                        volume: data.volume,
                        adjClose: data.adjClose,
                    }));
                    if (currentLogLevel === 'verbose') {
                        console.log(`DEBUG: dailyPriceRecords para ${position.positionKey} tiene ${dailyPriceRecords.length} registros.`);
                    }

                    // Usar bulkCreate con updateOnDuplicate para insertar/actualizar eficientemente
                    if (currentLogLevel === 'verbose') {
                        console.log(`DEBUG: Intentando bulkCreate para ${position.positionKey} con ${dailyPriceRecords.length} registros.`);
                    }
                    try {
                        const result = await DailyPrice.bulkCreate(dailyPriceRecords, {
                            updateOnDuplicate: ['open', 'high', 'low', 'close', 'volume', 'adjClose']
                        });
                        if (currentLogLevel === 'verbose') {
                            console.log(`✅ bulkCreate exitoso para ${position.positionKey}. Se afectaron ${result.length} registros.`);
                        }
                    } catch (dbError) {
                        if (currentLogLevel === 'verbose') {
                            console.error(`❌ Error al guardar/actualizar registros históricos para ${position.positionKey}:`, dbError);
                        }
                    }
                } else {
                    if (currentLogLevel === 'verbose') {
                        console.log(`⚠️ No se obtuvieron datos históricos de Yahoo Finance para ${position.positionKey}.`);
                    }
                }
            }

            const dailyPrices = await DailyPrice.findAll({
                where: {
                    userId,
                    portfolioId,
                    positionKey: position.positionKey,
                    date: {
                        [Op.gte]: oneYearAgo.toISOString().split('T')[0],
                        [Op.lte]: date
                    }
                },
                order: [['date', 'ASC']]
            });
            historicalPrices[position.positionKey] = dailyPrices.map(dp => ({
                date: dp.date,
                close: dp.close
            }));
            historicalChartData[position.positionKey] = transformHistoricalPricesToChartData(historicalPrices[position.positionKey]);
            if (currentLogLevel === 'verbose') {
                console.log(`Historical Prices for ${position.positionKey}:`, historicalPrices[position.positionKey].length);
                console.log(`Historical Chart Data for ${position.positionKey}:`, historicalChartData[position.positionKey].length);
            }
        }

        // 3. Obtener precios actuales
        const priceCaches = await PriceCache.findAll({
            where: { userId, portfolioId }
        });

        const currentPrices = {};
        priceCaches.forEach(cache => {
            currentPrices[cache.positionKey] = {
                price: cache.lastPrice,
                change: cache.change,
                changePercent: cache.changePercent,
                source: cache.source,
                updatedAt: cache.updatedAt
            };
        });

        // 4. Calcular valores totales
        let totalInvestedEUR = 0;
        let totalValueEUR = 0;

        Object.values(activePositions).forEach(position => {
            totalInvestedEUR += position.totalCost;

            const priceData = currentPrices[position.positionKey];
            if (priceData) {
                let valueEUR = 0;
                if (position.currency === 'EUR') {
                    valueEUR = position.shares * priceData.price;
                } else if (position.currency === 'USD' && currentEURUSD) {
                    valueEUR = position.shares * priceData.price * currentEURUSD;
                }
                totalValueEUR += valueEUR;
            }
        });

        const pnlEUR = totalValueEUR - totalInvestedEUR;

        // 5. Calcular métricas principales
        const roi = calculateROI(totalValueEUR, totalInvestedEUR);
        const winRateData = calculateWinRate(closedOperations);
        const avgHoldingTime = calculateAverageHoldingTime(closedOperations);

        // 6. Obtener estadísticas diarias recientes (últimos 30 días)
        const thirtyDaysAgo = new Date(date);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const dailyStats = await DailyPortfolioStats.findAll({
            where: {
                userId,
                portfolioId,
                date: {
                    [Op.gte]: thirtyDaysAgo.toISOString().split('T')[0],
                    [Op.lte]: date
                }
            },
            order: [['date', 'ASC']]
        });

        // 7. Calcular ganancias mensuales y mejor/peor mes
        // Usamos el servicio de PnL para obtener datos históricos precisos
        const monthlyGains = await calculateMonthlyAnalysis(userId, portfolioId);
        const realizedMonthlyGains = await calculateRealizedPnLByMonth(userId, portfolioId);
        const { bestMonth, worstMonth } = findBestWorstMonth(monthlyGains);
        const growthRate = calculateMonthlyGrowth(dailyStats);

        // 8. Calcular cambio diario
        let dailyChangeEUR = 0;
        if (dailyStats.length >= 2) {
            const yesterday = dailyStats[dailyStats.length - 2];
            dailyChangeEUR = calculateDailyChange(pnlEUR, yesterday.pnlEUR);
        }

        // 9. Top posiciones y contribución
        const topPositions = getTopPositions(activePositions, currentPrices, currentEURUSD, 10);
        const contributionByCompany = calculateContributionByCompany(activePositions, currentPrices, currentEURUSD);

        // 10. Índice de concentración
        const concentrationIndex = calculateConcentrationIndex(contributionByCompany, totalValueEUR);

        // 11. Generar alertas
        const alerts = await generateAlerts(userId, portfolioId, operations, currentPrices, currentEURUSD);

        // 12. Análisis Avanzado (Sector, Industria, Riesgo)
        const analysis = {
            sectorAllocation: {},
            industryAllocation: {},
            riskMetrics: {
                weightedBeta: 0,
                weightedDividendYield: 0
            }
        };

        try {
            // Extraer símbolos únicos de positionKey (format: "Company|||SYMBOL")
            const symbolsSet = new Set();
            Object.keys(activePositions).forEach(positionKey => {
                symbolsSet.add(positionKey); // El positionKey completo es lo que usamos como symbol
            });
            const symbols = Array.from(symbolsSet);

            const profiles = await AssetProfile.findAll({
                where: { symbol: { [Op.in]: symbols } }
            });

            const profileMap = {};
            profiles.forEach(p => profileMap[p.symbol] = p);

            let totalBetaWeight = 0;
            let totalDivWeight = 0;

            Object.values(activePositions).forEach(pos => {
                // Usar positionKey como símbolo (es el mismo que guardamos en AssetProfile)
                const symbol = pos.positionKey;
                const profile = profileMap[symbol];
                const priceData = currentPrices[pos.positionKey];

                if (priceData) {
                    let valueEUR = 0;
                    if (pos.currency === 'EUR') {
                        valueEUR = pos.shares * priceData.price;
                    } else if (pos.currency === 'USD' && currentEURUSD) {
                        valueEUR = pos.shares * priceData.price * currentEURUSD;
                    }

                    if (valueEUR > 0) {
                        // Sector
                        const sector = profile?.sector || 'Desconocido';
                        analysis.sectorAllocation[sector] = (analysis.sectorAllocation[sector] || 0) + valueEUR;

                        // Industry
                        const industry = profile?.industry || 'Desconocido';
                        analysis.industryAllocation[industry] = (analysis.industryAllocation[industry] || 0) + valueEUR;

                        // Risk Metrics (Weighted)
                        if (profile?.beta !== null && profile?.beta !== undefined) {
                            analysis.riskMetrics.weightedBeta += profile.beta * valueEUR;
                            totalBetaWeight += valueEUR;
                        }
                        if (profile?.dividendYield !== null && profile?.dividendYield !== undefined) {
                            analysis.riskMetrics.weightedDividendYield += profile.dividendYield * valueEUR;
                            totalDivWeight += valueEUR;
                        }
                    }
                }
            });

            // Normalize Weighted Metrics
            if (totalBetaWeight > 0) analysis.riskMetrics.weightedBeta /= totalBetaWeight;
            if (totalDivWeight > 0) analysis.riskMetrics.weightedDividendYield /= totalDivWeight;

        } catch (err) {
            console.error('Error calculating advanced analysis:', err);
        }

        // 13. Análisis de Drawdown y Mapa de Calor
        const drawdownData = [];
        const heatmapData = [];
        let peak = 0;
        let maxDrawdown = 0;
        let maxDrawdownDate = null;

        // Helper function to get PnL at or before a specific date
        const getPnlAtDate = (history, targetDateString) => {
            const entry = history.findLast(h => h.date <= targetDateString);
            return entry ? entry.pnlEUR : 0; // If no entry found, assume 0 PnL before history starts
        };

        // Helper function to calculate realized gains for specific periods from closed operations
        const calculateRealizedGainsForPeriods = (closedOps, reportDate) => {
            const today = new Date(reportDate);
            const firstDayOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const firstDayOf3MonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 1);
            const firstDayOfCurrentYear = new Date(today.getFullYear(), 0, 1);

            let realizedLastMonth = 0;
            let realizedLast3Months = 0;
            let realizedLastYear = 0;
            let realizedSinceInception = 0;

            for (const op of closedOps) {
                const exitDate = op.saleDate;
                const pnl = op.profitLoss || 0;

                realizedSinceInception += pnl;

                if (exitDate >= firstDayOfCurrentMonth) {
                    realizedLastMonth += pnl;
                }
                if (exitDate >= firstDayOf3MonthsAgo) {
                    realizedLast3Months += pnl;
                }
                if (exitDate >= firstDayOfCurrentYear) {
                    realizedLastYear += pnl;
                }
            }

            return {
                lastMonth: realizedLastMonth,
                last3Months: realizedLast3Months,
                lastYear: realizedLastYear,
                sinceInception: realizedSinceInception
            };
        };

        // Obtener historial de PnL para calcular drawdown y nuevas métricas
        let pnlHistory = [];
        try {
            const { calculatePortfolioHistory } = await import('./pnlService.js');
            // Fetch history for a sufficiently long period to cover "since inception" and "last year"
            // Let's assume 5 years (365 * 5 days) is enough for "since inception" for now.
            // A more robust solution would be to find the actual start date of the portfolio.
            pnlHistory = await calculatePortfolioHistory(userId, portfolioId, 365 * 5); // Fetch 5 years of history

            for (const day of pnlHistory) {
                const pnl = day.pnlEUR;

                // Cálculo de Drawdown
                if (pnl > peak) peak = pnl;
                const drawdown = peak > 0 ? ((pnl - peak) / peak) * 100 : 0;

                if (drawdown < maxDrawdown) {
                    maxDrawdown = drawdown;
                    maxDrawdownDate = day.date;
                }

                drawdownData.push({
                    date: day.date,
                    drawdown: drawdown,
                    pnl: pnl
                });

                // Datos de mapa de calor: cambio diario de PnL
                heatmapData.push({
                    date: day.date,
                    value: pnl
                });
            }
        } catch (err) {
            console.error('Error calculating drawdown or PnL history:', err);
        }

        // Calculate fixed period realized gains
        const fixedPeriodPnLMetrics = calculateRealizedGainsForPeriods(closedOperations, date);

        // 14. Construir datos del reporte
        const reportData = {
            // Estadísticas básicas
            totalInvestedEUR,
            totalValueEUR,
            pnlEUR,
            dailyChangeEUR,

            // New fixed period PnL metrics
            fixedPeriodPnLMetrics,

            // Métricas principales
            roi,
            winRate: winRateData.winRate,
            totalOperations: winRateData.totalOperations,
            successfulOperations: winRateData.successfulOperations,
            failedOperations: winRateData.failedOperations,
            avgHoldingTime,

            // Métricas mensuales/anuales
            monthlyGains,
            realizedMonthlyGains,
            bestMonth,
            worstMonth,
            growthRate,

            // Distribución
            topPositions,
            contributionByCompany,
            concentrationIndex,

            // Análisis Avanzado
            analysis,

            // Drawdown & Heatmap
            drawdownData,
            heatmapData,
            maxDrawdown,
            maxDrawdownDate,

            // Alertas
            alerts,
            alertsCount: {
                critical: alerts.filter(a => a.severity === 'critical').length,
                warning: alerts.filter(a => a.severity === 'warning').length,
                info: alerts.filter(a => a.severity === 'info').length
            },

            // Datos para gráficos
            chartData: transformDailyStatsToChartData(dailyStats),
            historicalPrices: historicalPrices,
            historicalChartData: historicalChartData,

            // Metadata
            generatedAt: new Date(),
            portfolioId,
            userId,
            date,
            exchangeRate: currentEURUSD || 0.92
        };

        if (currentLogLevel === 'verbose') {
            console.log('Final Report Data before saving:', reportData);
        }

        // 13. Guardar reporte en base de datos
        const [report, created] = await PortfolioReport.upsert({
            userId,
            portfolioId,
            date,
            reportType: 'daily',
            data: reportData
        }, {
            conflictFields: ['userId', 'portfolioId', 'date', 'reportType']
        });

        if (currentLogLevel === 'verbose') {
            console.log('Upsert result - report:', report);
        }
        if (currentLogLevel === 'verbose') {
            console.log('Upsert result - created:', created);
        }

        if (currentLogLevel === 'verbose') {
            console.log(`✅ Daily report generated for portfolio ${portfolioId} on ${date}`);
        }

        return reportData;
    } catch (error) {
        console.error('Error generating daily report:', error);
        throw error;
    }
}

/**
 * Genera un reporte mensual agregando datos diarios
 * @param {number} userId - ID del usuario
 * @param {number} portfolioId - ID del portafolio
 * @param {string} month - Mes en formato YYYY-MM
 * @returns {Object} Reporte mensual
 */
export async function generateMonthlyReport(userId, portfolioId, month) {
    const currentLogLevel = await getLogLevel();
    try {
        const [year, monthNum] = month.split('-');
        const startDate = `${year}-${monthNum}-01`;
        const endDate = new Date(year, monthNum, 0); // Último día del mes
        const endDateStr = endDate.toISOString().split('T')[0];

        // Obtener todos los reportes diarios del mes
        const dailyReports = await PortfolioReport.findAll({
            where: {
                userId,
                portfolioId,
                reportType: 'daily',
                date: {
                    [Op.gte]: startDate,
                    [Op.lte]: endDateStr
                }
            },
            order: [['date', 'ASC']]
        });

        if (dailyReports.length === 0) {
            if (currentLogLevel === 'verbose') {
                console.log(`No daily reports found for month ${month}`);
            }
            return null;
        }

        // Agregar datos mensuales
        const firstReport = dailyReports[0].data;
        const lastReport = dailyReports[dailyReports.length - 1].data;

        const monthlyData = {
            month,
            startValue: firstReport.totalValueEUR,
            endValue: lastReport.totalValueEUR,
            gain: lastReport.totalValueEUR - firstReport.totalValueEUR,
            growthRate: firstReport.totalValueEUR > 0
                ? ((lastReport.totalValueEUR - firstReport.totalValueEUR) / firstReport.totalValueEUR) * 100
                : 0,
            avgROI: dailyReports.reduce((sum, r) => sum + (r.data.roi || 0), 0) / dailyReports.length,
            avgWinRate: dailyReports.reduce((sum, r) => sum + (r.data.winRate || 0), 0) / dailyReports.length,
            totalAlerts: lastReport.alerts ? lastReport.alerts.length : 0,
            generatedAt: new Date()
        };

        // Guardar reporte mensual
        await PortfolioReport.upsert({
            userId,
            portfolioId,
            date: endDateStr,
            reportType: 'monthly',
            data: monthlyData
        }, {
            conflictFields: ['userId', 'portfolioId', 'date', 'reportType']
        });

        if (currentLogLevel === 'verbose') {
            console.log(`✅ Monthly report generated for ${month}`);
        }

        return monthlyData;
    } catch (error) {
        console.error('Error generating monthly report:', error);
        throw error;
    }
}

/**
 * Genera un reporte anual agregando datos mensuales
 * @param {number} userId - ID del usuario
 * @param {number} portfolioId - ID del portafolio
 * @param {number} year - Año
 * @returns {Object} Reporte anual
 */
export async function generateYearlyReport(userId, portfolioId, year) {
    const currentLogLevel = await getLogLevel();
    try {
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;

        // Obtener todos los reportes mensuales del año
        const monthlyReports = await PortfolioReport.findAll({
            where: {
                userId,
                portfolioId,
                reportType: 'monthly',
                date: {
                    [Op.gte]: startDate,
                    [Op.lte]: endDate
                }
            },
            order: [['date', 'ASC']]
        });

        if (monthlyReports.length === 0) {
            if (currentLogLevel === 'verbose') {
                console.log(`No monthly reports found for year ${year}`);
            }
            return null;
        }

        const firstReport = monthlyReports[0].data;
        const lastReport = monthlyReports[monthlyReports.length - 1].data;

        const yearlyData = {
            year,
            startValue: firstReport.startValue,
            endValue: lastReport.endValue,
            gain: lastReport.endValue - firstReport.startValue,
            growthRate: firstReport.startValue > 0
                ? ((lastReport.endValue - firstReport.startValue) / firstReport.startValue) * 100
                : 0,
            monthlyGains: monthlyReports.map(r => ({
                month: r.data.month,
                gain: r.data.gain,
                growthRate: r.data.growthRate
            })),
            avgROI: monthlyReports.reduce((sum, r) => sum + (r.data.avgROI || 0), 0) / monthlyReports.length,
            generatedAt: new Date()
        };

        // Guardar reporte anual
        await PortfolioReport.upsert({
            userId,
            portfolioId,
            date: endDate,
            reportType: 'yearly',
            data: yearlyData
        }, {
            conflictFields: ['userId', 'portfolioId', 'date', 'reportType']
        });

        if (currentLogLevel === 'verbose') {
            console.log(`✅ Yearly report generated for ${year}`);
        }

        return yearlyData;
    } catch (error) {
        console.error('Error generating yearly report:', error);
        throw error;
    }
}

// Exportar funciones individuales también
export { calculateROI, calculateWinRate, calculateAverageHoldingTime };
