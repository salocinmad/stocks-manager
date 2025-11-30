/**
 * Calculador de PnL (Profit and Loss)
 * Funciones para calcular ganancias/pérdidas con FIFO
 */

import { createPositionKey } from '../../utils/symbolHelpers.js';
import { groupOperationsByPosition } from './positionAggregator.js';

/**
 * Calcula operaciones cerradas (ventas con sus compras asociadas por FIFO)
 * @param {Array} operations - Array de operaciones ordenadas por fecha
 * @returns {Array} Array de operaciones cerradas con profit/loss calculado
 */
export function calculateClosedOperations(operations) {
    const grouped = groupOperationsByPosition(operations);
    const closedOperations = [];

    Object.values(grouped).forEach(position => {
        const purchases = position.purchases.sort((a, b) => new Date(a.date) - new Date(b.date));
        const sales = position.sales.sort((a, b) => new Date(a.date) - new Date(b.date));

        sales.forEach(sale => {
            let remainingShares = sale.shares;
            let totalPurchaseCost = 0;
            let purchaseDates = [];

            // FIFO: asignar compras a esta venta
            for (const purchase of purchases) {
                if (remainingShares <= 0) break;

                const sharesToUse = Math.min(remainingShares, purchase.shares);
                const costPerShare = purchase.totalCost / purchase.shares;
                totalPurchaseCost += sharesToUse * costPerShare;

                for (let i = 0; i < sharesToUse; i++) {
                    purchaseDates.push(purchase.date);
                }

                remainingShares -= sharesToUse;
            }

            // Calcular profit/loss
            const saleRevenue = sale.shares * sale.price * sale.exchangeRate;
            const saleCommission = sale.commission * sale.exchangeRate;
            const netSaleRevenue = saleRevenue - saleCommission;
            const profitLoss = netSaleRevenue - totalPurchaseCost;

            // Calcular fecha promedio de compra
            let avgPurchaseDate = null;
            if (purchaseDates.length > 0) {
                const dates = purchaseDates.map(d => new Date(d));
                const avgTimestamp = dates.reduce((sum, d) => sum + d.getTime(), 0) / dates.length;
                avgPurchaseDate = new Date(avgTimestamp);
            }

            closedOperations.push({
                ...sale,
                purchaseDate: avgPurchaseDate,
                saleDate: new Date(sale.date),
                purchaseCost: totalPurchaseCost,
                saleRevenue: netSaleRevenue,
                profitLoss,
                profitLossPercent: totalPurchaseCost > 0 ? (profitLoss / totalPurchaseCost) * 100 : 0
            });
        });
    });

    return closedOperations;
}

/**
 * Calcula PnL diario usando previousClose y previousCloseDate
 * @param {Object} currentPrice - Precio actual del GlobalCurrentPrice
 * @param {Object} previousPrice - Precio del GlobalStockPrice del previousCloseDate
 * @param {number} shares - Número de acciones
 * @param {number} exchangeRate - Tipo de cambio a EUR
 * @returns {Object} PnL diario
 */
export function calculateDailyPnL(currentPrice, previousPrice, shares, exchangeRate = 1) {
    if (!currentPrice || !shares) {
        return { pnl: 0, pnlPercent: 0 };
    }

    const currentValue = currentPrice.lastPrice * shares;
    const previousValue = (previousPrice?.close || currentPrice.previousClose) * shares;

    const pnl = (currentValue - previousValue) * exchangeRate;
    const pnlPercent = previousValue > 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0;

    return {
        pnl,
        pnlPercent,
        currentValue: currentValue * exchangeRate,
        previousValue: previousValue * exchangeRate,
        previousCloseDate: currentPrice.previousCloseDate || previousPrice?.date
    };
}

/**
 * Calcula PnL total de un portfolio
 * @param {Array} positions - Array de posiciones con currentPrice y shares
 * @param {number} totalInvested - Total invertido en EUR
 * @returns {Object} PnL total
 */
export function calculateTotalPnL(positions, totalInvested) {
    let totalCurrentValue = 0;

    positions.forEach(pos => {
        if (pos.currentPrice && pos.shares) {
            totalCurrentValue += pos.currentPrice * pos.shares * (pos.exchangeRate || 1);
        }
    });

    const totalPnL = totalCurrentValue - totalInvested;
    const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

    return {
        totalCurrentValue,
        totalInvested,
        totalPnL,
        totalPnLPercent
    };
}

export default {
    calculateClosedOperations,
    calculateDailyPnL,
    calculateTotalPnL
};
