/**
 * Funciones puras para cálculo de métricas financieras
 * Estas funciones no tienen efectos secundarios y son fáciles de testear
 */

/**
 * Calcula el ROI (Return on Investment)
 * @param {number} totalValueEUR - Valor total actual en EUR
 * @param {number} totalInvestedEUR - Inversión total en EUR
 * @returns {number} ROI en porcentaje
 */
export function calculateROI(totalValueEUR, totalInvestedEUR) {
    if (!totalInvestedEUR || totalInvestedEUR === 0) return 0;
    return ((totalValueEUR - totalInvestedEUR) / totalInvestedEUR) * 100;
}

/**
 * Calcula el Win Rate (porcentaje de operaciones exitosas)
 * @param {Array} closedOperations - Array de operaciones cerradas (ventas)
 * @returns {Object} { winRate, totalOperations, successfulOperations, failedOperations }
 */
export function calculateWinRate(closedOperations) {
    if (!closedOperations || closedOperations.length === 0) {
        return {
            winRate: 0,
            totalOperations: 0,
            successfulOperations: 0,
            failedOperations: 0
        };
    }

    let successfulOperations = 0;
    let failedOperations = 0;

    closedOperations.forEach(sale => {
        // Determinar si la operación fue exitosa comparando precio de venta vs compra
        // Una venta es exitosa si el precio de venta es mayor que el coste promedio de compra
        if (sale.profitLoss && sale.profitLoss > 0) {
            successfulOperations++;
        } else {
            failedOperations++;
        }
    });

    const totalOperations = closedOperations.length;
    const winRate = (successfulOperations / totalOperations) * 100;

    return {
        winRate,
        totalOperations,
        successfulOperations,
        failedOperations
    };
}

/**
 * Calcula el tiempo promedio de tenencia de posiciones
 * @param {Array} closedOperations - Array de operaciones cerradas
 * @returns {number} Tiempo promedio en días
 */
export function calculateAverageHoldingTime(closedOperations) {
    if (!closedOperations || closedOperations.length === 0) return 0;

    let totalDays = 0;
    let count = 0;

    closedOperations.forEach(sale => {
        if (sale.purchaseDate && sale.saleDate) {
            const purchaseDate = new Date(sale.purchaseDate);
            const saleDate = new Date(sale.saleDate);
            const diffTime = Math.abs(saleDate - purchaseDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            totalDays += diffDays;
            count++;
        }
    });

    return count > 0 ? totalDays / count : 0;
}

/**
 * Calcula la tasa de crecimiento mensual
 * @param {Array} dailyStats - Array de estadísticas diarias ordenadas por fecha
 * @returns {number} Tasa de crecimiento en porcentaje
 */
export function calculateMonthlyGrowth(dailyStats) {
    if (!dailyStats || dailyStats.length < 2) return 0;

    const firstStat = dailyStats[0];
    const lastStat = dailyStats[dailyStats.length - 1];

    if (!firstStat.totalValueEUR || firstStat.totalValueEUR === 0) return 0;

    return ((lastStat.totalValueEUR - firstStat.totalValueEUR) / firstStat.totalValueEUR) * 100;
}

/**
 * Agrupa estadísticas diarias por mes y calcula ganancias
 * @param {Array} dailyStats - Array de estadísticas diarias
 * @returns {Array} Array de { month, gain, startValue, endValue }
 */
export function calculateMonthlyGains(dailyStats) {
    if (!dailyStats || dailyStats.length === 0) return [];

    const monthlyData = {};

    dailyStats.forEach(stat => {
        const date = new Date(stat.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                month: monthKey,
                startValue: stat.totalValueEUR,
                endValue: stat.totalValueEUR,
                startDate: stat.date,
                endDate: stat.date
            };
        } else {
            monthlyData[monthKey].endValue = stat.totalValueEUR;
            monthlyData[monthKey].endDate = stat.date;
        }
    });

    // Calcular ganancia por mes
    const result = Object.values(monthlyData).map(data => ({
        month: data.month,
        gain: data.endValue - data.startValue,
        startValue: data.startValue,
        endValue: data.endValue,
        growthRate: data.startValue > 0 ? ((data.endValue - data.startValue) / data.startValue) * 100 : 0
    }));

    return result.sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Encuentra el mejor y peor mes
 * @param {Array} monthlyGains - Array de ganancias mensuales
 * @returns {Object} { bestMonth, worstMonth }
 */
export function findBestWorstMonth(monthlyGains) {
    if (!monthlyGains || monthlyGains.length === 0) {
        return { bestMonth: null, worstMonth: null };
    }

    let bestMonth = monthlyGains[0];
    let worstMonth = monthlyGains[0];

    monthlyGains.forEach(month => {
        if (month.gain > bestMonth.gain) {
            bestMonth = month;
        }
        if (month.gain < worstMonth.gain) {
            worstMonth = month;
        }
    });

    return { bestMonth, worstMonth };
}

/**
 * Calcula el cambio diario del PnL
 * @param {number} currentPnL - PnL actual
 * @param {number} previousPnL - PnL del día anterior
 * @returns {number} Cambio diario en EUR
 */
export function calculateDailyChange(currentPnL, previousPnL) {
    if (previousPnL === null || previousPnL === undefined) return 0;
    return currentPnL - previousPnL;
}

/**
 * Calcula el índice de concentración de Herfindahl-Hirschman
 * @param {Array} positions - Array de posiciones con valor en EUR
 * @param {number} totalPortfolioValue - Valor total del portafolio
 * @returns {number} Índice HHI (0-10000)
 */
export function calculateConcentrationIndex(positions, totalPortfolioValue) {
    if (!positions || positions.length === 0 || totalPortfolioValue === 0) return 0;

    let hhi = 0;
    positions.forEach(position => {
        const marketShare = (position.valueEUR / totalPortfolioValue) * 100;
        hhi += Math.pow(marketShare, 2);
    });

    return hhi;
}

/**
 * Normaliza valores para gráficos de calor (0-4)
 * @param {number} value - Valor a normalizar
 * @param {number} maxAbsValue - Valor absoluto máximo
 * @returns {number} Nivel de intensidad (0-4)
 */
export function normalizeToIntensityLevel(value, maxAbsValue) {
    if (maxAbsValue === 0 || !value) return 0;

    const absValue = Math.abs(value);
    const percentage = absValue / maxAbsValue;

    if (percentage === 0) return 0;
    if (percentage <= 0.25) return 1;
    if (percentage <= 0.50) return 2;
    if (percentage <= 0.75) return 3;
    return 4;
}
