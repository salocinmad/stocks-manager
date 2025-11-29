import { Op } from 'sequelize';
import Operation from '../models/Operation.js';
import DailyPortfolioStats from '../models/DailyPortfolioStats.js';
import PriceCache from '../models/PriceCache.js';
import Portfolio from '../models/Portfolio.js';
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
    try {
        // 1. Obtener operaciones del portafolio
        const operations = await Operation.findAll({
            where: { userId, portfolioId },
            order: [['date', 'ASC']]
        });

        if (operations.length === 0) {
            // console.log(`No operations found for portfolio ${portfolioId}`);
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

        // console.log('Active Positions:', activePositions);

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

            // console.log(`📊 existingDailyPrices.length for ${position.positionKey}: ${existingDailyPrices.length}`);
            // Si no hay suficientes datos (menos de 365 días), obtener de Yahoo Finance
            if (existingDailyPrices.length < 365) {
                // console.log(`✅ Entrando al bloque de obtención de datos históricos de Yahoo Finance para ${position.positionKey}.`);
                // console.log(`⏳ Obteniendo datos históricos de Yahoo Finance para ${position.positionKey}...`);
                // console.log(`DEBUG: existingDailyPrices.length es ${existingDailyPrices.length}, se intentará obtener de Yahoo Finance.`);
                console.error(`ERROR_DEBUG: Entrando al bloque de obtención de datos históricos de Yahoo Finance para ${position.positionKey}.`);
                let yahooHistoricalData = [];
                try {
                    yahooHistoricalData = await fetchHistorical(position.positionKey, 365);
                    // console.log(`🔍 Yahoo Historical Data length for ${position.positionKey}: ${yahooHistoricalData.length}`);
                } catch (error) {
                    console.error(`❌ Error al obtener datos históricos de Yahoo Finance para ${position.positionKey}:`, error.message);
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
                    // console.log(`DEBUG: dailyPriceRecords para ${position.positionKey} tiene ${dailyPriceRecords.length} registros. Primer registro:`, dailyPriceRecords[0]);

                    // Usar bulkCreate con updateOnDuplicate para insertar/actualizar eficientemente
                    // console.log(`DEBUG: Intentando bulkCreate para ${position.positionKey} con ${dailyPriceRecords.length} registros.`);
                    try {
                        const result = await DailyPrice.bulkCreate(dailyPriceRecords, {
                            updateOnDuplicate: ['open', 'high', 'low', 'close', 'volume', 'adjClose']
                        });
                        // console.log(`✅ bulkCreate exitoso para ${position.positionKey}. Se afectaron ${result.length} registros.`);
                    } catch (dbError) {
                        console.error(`❌ Error al guardar/actualizar registros históricos para ${position.positionKey}:`, dbError);
                    }
                } else {
                    // console.log(`⚠️ No se obtuvieron datos históricos de Yahoo Finance para ${position.positionKey}.`);
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
            // console.log(`Historical Prices for ${position.positionKey}:`, historicalPrices[position.positionKey].length);
            // console.log(`Historical Chart Data for ${position.positionKey}:`, historicalChartData[position.positionKey].length);
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
        const monthlyGains = calculateMonthlyGains(dailyStats);
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

        // 12. Construir datos del reporte
        const reportData = {
            // Estadísticas básicas
            totalInvestedEUR,
            totalValueEUR,
            pnlEUR,
            dailyChangeEUR,

            // Métricas principales
            roi,
            winRate: winRateData.winRate,
            totalOperations: winRateData.totalOperations,
            successfulOperations: winRateData.successfulOperations,
            failedOperations: winRateData.failedOperations,
            avgHoldingTime,

            // Métricas mensuales/anuales
            monthlyGains,
            bestMonth,
            worstMonth,
            growthRate,

            // Distribución
            topPositions,
            contributionByCompany,
            concentrationIndex,

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

        // console.log('Final Report Data before saving:', reportData);

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

        // console.log('Upsert result - report:', report);
        // console.log('Upsert result - created:', created);

        // console.log(`✅ Daily report generated for portfolio ${portfolioId} on ${date}`);

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
            // console.log(`No daily reports found for month ${month}`);
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

        // console.log(`✅ Monthly report generated for ${month}`);

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
            console.log(`No monthly reports found for year ${year}`);
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

        console.log(`✅ Yearly report generated for ${year}`);

        return yearlyData;
    } catch (error) {
        console.error('Error generating yearly report:', error);
        throw error;
    }
}

// Exportar funciones individuales también
export { calculateROI, calculateWinRate, calculateAverageHoldingTime };
