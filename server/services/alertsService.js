import DailyPrice from '../models/DailyPrice.js';
import PriceCache from '../models/PriceCache.js';
import { calculateActivePositions, calculateContributionByCompany } from '../utils/dataAggregator.js';
import { getLogLevel } from './configService.js';

/**
 * Servicio modular para generar y gestionar alertas del portafolio
 */

/**
 * Tipos de alertas soportadas
 */
export const AlertTypes = {
    LOSS_SUSTAINED: 'loss_sustained',
    PROFIT_OPPORTUNITY: 'profit_opportunity',
    CONCENTRATION: 'concentration',
    TARGET_HIT: 'target_hit'
};

/**
 * Niveles de severidad de alertas
 */
export const AlertSeverity = {
    INFO: 'info',
    WARNING: 'warning',
    CRITICAL: 'critical'
};

/**
 * Verifica si una posición tiene pérdidas sostenidas durante N días
 * @param {Object} position - Posición a verificar
 * @param {number} userId - ID del usuario
 * @param {number} portfolioId - ID del portafolio
 * @param {number} days - Número de días a verificar (default: 30)
 * @param {number} threshold - Umbral de pérdida en porcentaje (default: 15)
 * @returns {Object|null} Alerta o null si no aplica
 */
export async function checkLossSustained(position, userId, portfolioId, days = 30, threshold = 15) {
    const currentLogLevel = await getLogLevel();
    try {
        const currentPrice = await PriceCache.findOne({
            where: {
                userId,
                portfolioId,
                positionKey: position.positionKey
            }
        });

        if (!currentPrice) return null;

        // Buscar precio hace N días
        const dateNDaysAgo = new Date();
        dateNDaysAgo.setDate(dateNDaysAgo.getDate() - days);

        const priceNDaysAgo = await DailyPrice.findOne({
            where: {
                userId,
                portfolioId,
                positionKey: position.positionKey,
                date: dateNDaysAgo.toISOString().split('T')[0]
            }
        });

        if (!priceNDaysAgo) return null;

        // Calcular cambio porcentual
        const changePercent = ((currentPrice.lastPrice - priceNDaysAgo.close) / priceNDaysAgo.close) * 100;

        // Si la pérdida es mayor al umbral
        if (changePercent < -threshold) {
            return {
                type: AlertTypes.LOSS_SUSTAINED,
                severity: changePercent < -25 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
                positionKey: position.positionKey,
                company: position.company,
                symbol: position.symbol || '',
                message: `${position.company} ha caído ${Math.abs(changePercent).toFixed(1)}% en los últimos ${days} días`,
                data: {
                    currentPrice: currentPrice.lastPrice,
                    priceNDaysAgo: priceNDaysAgo.close,
                    changePercent,
                    days,
                    currency: position.currency
                },
                createdAt: new Date()
            };
        }

        return null;
    } catch (error) {
        if (currentLogLevel === 'verbose') {
            console.error('Error checking loss sustained:', error);
        }
        return null;
    }
}

/**
 * Verifica si hay oportunidad de tomar beneficios (ganancia > threshold)
 * @param {Object} position - Posición a verificar
 * @param {number} currentPrice - Precio actual
 * @param {number} threshold - Umbral de ganancia en porcentaje (default: 20)
 * @returns {Object|null} Alerta o null si no aplica
 */
export function checkProfitOpportunity(position, currentPrice, threshold = 20) {
    if (!position || !currentPrice || position.totalCost === 0) return null;

    const avgCostPerShare = position.totalCost / position.shares;
    const profitPercent = ((currentPrice - avgCostPerShare) / avgCostPerShare) * 100;

    if (profitPercent > threshold) {
        return {
            type: AlertTypes.PROFIT_OPPORTUNITY,
            severity: AlertSeverity.INFO,
            positionKey: position.positionKey,
            company: position.company,
            symbol: position.symbol || '',
            message: `${position.company} tiene una ganancia del ${profitPercent.toFixed(1)}% - Considerar tomar beneficios`,
            data: {
                currentPrice,
                avgCostPerShare,
                profitPercent,
                totalGainEUR: (currentPrice - avgCostPerShare) * position.shares,
                shares: position.shares
            },
            createdAt: new Date()
        };
    }

    return null;
}

/**
 * Verifica si hay concentración excesiva en una posición
 * @param {Object} position - Posición a verificar
 * @param {number} positionValueEUR - Valor de la posición en EUR
 * @param {number} totalPortfolioValueEUR - Valor total del portafolio en EUR
 * @param {number} threshold - Umbral de concentración en porcentaje (default: 30)
 * @returns {Object|null} Alerta o null si no aplica
 */
export function checkConcentrationRisk(position, positionValueEUR, totalPortfolioValueEUR, threshold = 30) {
    if (!position || totalPortfolioValueEUR === 0) return null;

    const concentrationPercent = (positionValueEUR / totalPortfolioValueEUR) * 100;

    if (concentrationPercent > threshold) {
        return {
            type: AlertTypes.CONCENTRATION,
            severity: concentrationPercent > 50 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
            positionKey: position.positionKey,
            company: position.company,
            symbol: position.symbol || '',
            message: `${position.company} representa ${concentrationPercent.toFixed(1)}% del portafolio (concentración excesiva)`,
            data: {
                positionValueEUR,
                totalPortfolioValueEUR,
                concentrationPercent
            },
            createdAt: new Date()
        };
    }

    return null;
}

/**
 * Genera todas las alertas para un portafolio
 * @param {number} userId - ID del usuario
 * @param {number} portfolioId - ID del portafolio
 * @param {Array} operations - Array de operaciones
 * @param {Object} currentPrices - Objeto de precios actuales
 * @param {number} currentEURUSD - Tipo de cambio EUR/USD actual
 * @returns {Array} Array de alertas generadas
 */
export async function generateAlerts(userId, portfolioId, operations, currentPrices, currentEURUSD) {
    const alerts = [];
    const currentLogLevel = await getLogLevel();

    try {
        // Calcular posiciones activas
        const activePositions = calculateActivePositions(operations);

        // Calcular valor total del portafolio
        let totalPortfolioValueEUR = 0;
        const positionValues = {};

        Object.entries(activePositions).forEach(([key, position]) => {
            const priceData = currentPrices[key];
            if (!priceData) return;

            let valueEUR = 0;
            const currentPrice = priceData.price;

            if (position.currency === 'EUR') {
                valueEUR = position.shares * currentPrice;
            } else if (position.currency === 'USD') {
                valueEUR = position.shares * currentPrice * (currentEURUSD || 0.92);
            }

            totalPortfolioValueEUR += valueEUR;
            positionValues[key] = valueEUR;
        });

        // Verificar cada posición
        for (const [key, position] of Object.entries(activePositions)) {
            const priceData = currentPrices[key];
            if (!priceData) continue;

            // 1. Verificar pérdidas sostenidas
            const lossAlert = await checkLossSustained(position, userId, portfolioId);
            if (lossAlert) alerts.push(lossAlert);

            // 2. Verificar oportunidades de ganancia
            const profitAlert = checkProfitOpportunity(position, priceData.price);
            if (profitAlert) alerts.push(profitAlert);

            // 3. Verificar concentración
            const valueEUR = positionValues[key];
            const concentrationAlert = checkConcentrationRisk(position, valueEUR, totalPortfolioValueEUR);
            if (concentrationAlert) alerts.push(concentrationAlert);
        }

        // Ordenar por severidad (crítico primero)
        alerts.sort((a, b) => {
            const severityOrder = {
                critical: 3,
                warning: 2,
                info: 1
            };
            return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
        });

        return alerts;
    } catch (error) {
        if (currentLogLevel === 'verbose') {
            console.error('Error generating alerts:', error);
        }
        return [];
    }
}

/**
 * Filtra alertas por tipo
 * @param {Array} alerts - Array de alertas
 * @param {string} type - Tipo de alerta a filtrar
 * @returns {Array} Array de alertas filtradas
 */
export function filterAlertsByType(alerts, type) {
    return alerts.filter(alert => alert.type === type);
}

/**
 * Filtra alertas por severidad
 * @param {Array} alerts - Array de alertas
 * @param {string} severity - Severidad a filtrar
 * @returns {Array} Array de alertas filtradas
 */
export function filterAlertsBySeverity(alerts, severity) {
    return alerts.filter(alert => alert.severity === severity);
}

/**
 * Obtiene el número de alertas por severidad
 * @param {Array} alerts - Array de alertas
 * @returns {Object} Conteo por severidad
 */
export function getAlertCountBySeverity(alerts) {
    const counts = {
        critical: 0,
        warning: 0,
        info: 0
    };

    alerts.forEach(alert => {
        if (counts[alert.severity] !== undefined) {
            counts[alert.severity]++;
        }
    });

    return counts;
}
