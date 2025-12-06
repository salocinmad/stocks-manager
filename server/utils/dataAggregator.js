/**
 * Utilidades para agregar y transformar datos desde la base de datos
 */

/**
 * Agrupa operaciones por positionKey
 * @param {Array} operations - Array de operaciones
 * @returns {Object} Objeto con operaciones agrupadas por positionKey
 */
export function groupOperationsByPosition(operations) {
    const grouped = {};

    operations.forEach(op => {
        const key = op.symbol ? `${op.company}|||${op.symbol}` : op.company;

        if (!grouped[key]) {
            grouped[key] = {
                positionKey: key,
                company: op.company,
                symbol: op.symbol || '',
                purchases: [],
                sales: [],
                currency: op.currency
            };
        }

        if (op.type === 'purchase') {
            grouped[key].purchases.push(op);
        } else if (op.type === 'sale') {
            grouped[key].sales.push(op);
        }
    });

    return grouped;
}

/**
 * Calcula posiciones activas desde operaciones
 * @param {Array} operations - Array de operaciones
 * @returns {Object} Objeto con posiciones activas
 */
export function calculateActivePositions(operations) {
    const positions = {};

    operations.forEach(op => {
        const key = op.symbol ? `${op.company}|||${op.symbol}` : op.company;

        if (!positions[key]) {
            positions[key] = {
                positionKey: key,
                company: op.company,
                symbol: op.symbol || '',
                shares: 0,
                totalCost: 0,
                totalOriginalCost: 0,
                currency: op.currency || 'EUR',
                operations: []
            };
        }

        const sharesDelta = op.type === 'purchase' ? op.shares : -op.shares;
        positions[key].shares += sharesDelta;

        if (op.type === 'purchase') {
            positions[key].totalCost += op.totalCost;
            positions[key].totalOriginalCost += op.shares * op.price;
        } else {
            // En ventas, reducir el coste proporcionalmente
            const proportion = op.shares / (positions[key].shares + op.shares);
            positions[key].totalCost -= positions[key].totalCost * proportion;
            positions[key].totalOriginalCost -= positions[key].totalOriginalCost * proportion;
        }

        positions[key].operations.push(op);
    });

    // Filtrar solo las posiciones activas (con shares > 0)
    const activePositions = {};
    Object.keys(positions).forEach(key => {
        if (positions[key].shares > 0) {
            activePositions[key] = positions[key];
        }
    });

    return activePositions;
}

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
 * Transforma array de DailyPortfolioStats a formato de gráfico
 * @param {Array} dailyStats - Array de estadísticas diarias
 * @returns {Array} Array formateado para gráficos
 */
export function transformDailyStatsToChartData(dailyStats) {
    if (!dailyStats || dailyStats.length === 0) return [];

    return dailyStats.map(stat => ({
        date: stat.date,
        value: stat.totalValueEUR,
        invested: stat.totalInvestedEUR,
        pnl: stat.pnlEUR
    }));
}

/**
 * Calcula top positions por valor
 * @param {Object} activePositions - Objeto de posiciones activas
 * @param {Object} currentPrices - Objeto de precios actuales
 * @param {number} currentEURUSD - Tipo de cambio actual EUR/USD
 * @param {number} limit - Número máximo de posiciones a retornar
 * @returns {Array} Array de top posiciones ordenadas por valor DESC
 */
export function getTopPositions(activePositions, currentPrices, currentEURUSD, limit = 10) {
    const positionsWithValue = Object.entries(activePositions).map(([key, position]) => {
        const priceData = currentPrices[key];
        if (!priceData) return null;

        let valueEUR = 0;
        const currentPrice = priceData.price;

        if (position.currency === 'EUR') {
            valueEUR = position.shares * currentPrice;
        } else if (position.currency === 'USD') {
            valueEUR = position.shares * currentPrice * (currentEURUSD || 0.92);
        }

        return {
            positionKey: key,
            company: position.company,
            symbol: position.symbol,
            shares: position.shares,
            currentPrice,
            valueEUR,
            currency: position.currency
        };
    }).filter(p => p !== null);

    // Ordenar por valor descendente
    positionsWithValue.sort((a, b) => b.valueEUR - a.valueEUR);

    return positionsWithValue.slice(0, limit);
}

/**
 * Calcula la contribución de cada empresa al valor total del portafolio
 * @param {Object} activePositions - Objeto de posiciones activas
 * @param {Object} currentPrices - Objeto de precios actuales
 * @param {number} currentEURUSD - Tipo de cambio actual
 * @returns {Array} Array de contribuciones por empresa
 */
export function calculateContributionByCompany(activePositions, currentPrices, currentEURUSD) {
    let totalPortfolioValue = 0;
    const contributions = [];

    // Calcular valor de cada posición
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

        totalPortfolioValue += valueEUR;

        contributions.push({
            company: position.company,
            symbol: position.symbol,
            valueEUR,
            shares: position.shares,
            currentPrice
        });
    });

    // Calcular porcentaje de contribución
    const contributionsWithPercentage = contributions.map(c => ({
        ...c,
        percentage: totalPortfolioValue > 0 ? (c.valueEUR / totalPortfolioValue) * 100 : 0
    }));

    // Ordenar por valor descendente
    contributionsWithPercentage.sort((a, b) => b.valueEUR - a.valueEUR);

    return contributionsWithPercentage;
}

/**
 * Transforma array de precios diarios históricos a formato de gráfico
 * @param {Array} historicalPrices - Array de precios diarios históricos ({ date, close })
 * @returns {Array} Array formateado para gráficos
 */
export function transformHistoricalPricesToChartData(historicalPrices) {
    if (!historicalPrices || historicalPrices.length === 0) return [];

    // Tomar solo los últimos 30 días
    const last30Days = historicalPrices.slice(-30);

    return last30Days.map(price => ({
        date: price.date,
        value: price.close
    }));
}
