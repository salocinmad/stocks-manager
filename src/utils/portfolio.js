// Funciones puras de portfolio

export const getPositions = (operations) => {
  const positions = {};

  // CRÍTICO: Ordenar operaciones por fecha cronológicamente, luego por ID
  const sortedOperations = [...operations].sort((a, b) => {
    const dateCompare = new Date(a.date) - new Date(b.date);
    if (dateCompare !== 0) return dateCompare;
    // Si las fechas son iguales, ordenar por ID (menor ID = más antiguo)
    return (a.id || 0) - (b.id || 0);
  });

  sortedOperations.forEach(op => {
    const positionKey = op.symbol ? `${op.company}|||${op.symbol}` : op.company;
    if (!positions[positionKey]) {
      positions[positionKey] = {
        shares: 0,
        totalCost: 0,
        totalOriginalCost: 0,
        currency: 'EUR',
        company: op.company,
        symbol: op.symbol || ''
      };
    }
    if (op.currency) {
      positions[positionKey].currency = op.currency;
    }
    if (op.type === 'purchase') {
      positions[positionKey].shares += parseInt(op.shares);
      positions[positionKey].totalCost += parseFloat(op.totalCost);
      // totalOriginalCost incluye comisión en moneda original
      const commissionInOriginalCurrency = parseFloat(op.commission || 0) / (parseFloat(op.exchangeRate) || 1);
      positions[positionKey].totalOriginalCost += parseFloat(op.price) * parseInt(op.shares) + commissionInOriginalCurrency;
    } else if (op.type === 'sale') {
      const sharesSold = parseInt(op.shares);
      const currentShares = positions[positionKey].shares;
      const avgCost = currentShares > 0 ? positions[positionKey].totalCost / currentShares : 0;
      positions[positionKey].shares -= sharesSold;
      positions[positionKey].totalCost -= avgCost * sharesSold;
      const avgOriginalCost = currentShares > 0 ? positions[positionKey].totalOriginalCost / currentShares : 0;
      positions[positionKey].totalOriginalCost -= avgOriginalCost * sharesSold;
    }
  });
  return positions;
};

export const getActivePositions = (operations, sortPositions) => {
  const positions = getPositions(operations);
  const activePositions = Object.fromEntries(
    Object.entries(positions).filter(([_, position]) => position.shares > 0)
  );
  return typeof sortPositions === 'function' ? sortPositions(activePositions) : activePositions;
};

export const getClosedOperations = (operations) => {
  const positions = getPositions(operations);
  const closedPositionKeys = Object.keys(positions).filter(positionKey => positions[positionKey].shares === 0);
  return operations.filter(op => {
    const opKey = op.symbol ? `${op.company}|||${op.symbol}` : op.company;
    return closedPositionKeys.includes(opKey);
  });
};

export const getHistoricalProfitLoss = (operations) => {
  const closedOperations = getClosedOperations(operations);
  const sales = closedOperations.filter(op => op.type === 'sale');
  let totalProfit = 0;
  sales.forEach(sale => {
    const company = sale.company;
    const companyPurchases = operations
      .filter(op => op.company === company && op.type === 'purchase')
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    let remainingShares = sale.shares;
    let totalPurchaseCost = 0;
    for (const purchase of companyPurchases) {
      if (remainingShares <= 0) break;
      const sharesToUse = Math.min(remainingShares, purchase.shares);
      const costPerShare = purchase.totalCost / purchase.shares;
      totalPurchaseCost += sharesToUse * costPerShare;
      remainingShares -= sharesToUse;
    }
    const saleRevenue = sale.shares * sale.price * sale.exchangeRate;
    const saleCommission = sale.commission * sale.exchangeRate;
    const netSaleRevenue = saleRevenue - saleCommission;
    const profit = netSaleRevenue - totalPurchaseCost;
    totalProfit += profit;
  });
  return totalProfit;
};

export const getStats = (operations, currentPrices, currentEURUSD, sortPositions) => {
  const activePositions = getActivePositions(operations, sortPositions);
  let totalValue = 0;
  Object.entries(activePositions).forEach(([positionKey, position]) => {
    const priceData = currentPrices[positionKey];
    if (priceData && priceData.price) {
      const companyOperations = operations.filter(op => {
        const opKey = op.symbol ? `${op.company}|||${op.symbol}` : op.company;
        return opKey === positionKey;
      });
      const purchases = companyOperations.filter(op => op.type === 'purchase');
      let currency = 'EUR';
      if (purchases.length > 0) {
        const latestPurchase = purchases.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        currency = latestPurchase?.currency || 'EUR';
      }
      const valueInBaseCurrency = position.shares * priceData.price;
      let valueInEUR;
      if (currency === 'EUR') {
        valueInEUR = valueInBaseCurrency;
      } else if (currency === 'USD') {
        const eurPerUsd = currentEURUSD || 0.92;
        valueInEUR = valueInBaseCurrency * eurPerUsd;
      } else {
        let weightedExchangeRate = 1;
        if (purchases.length > 0) {
          let totalShares = 0;
          let totalExchangeRateWeighted = 0;
          purchases.forEach(purchase => {
            totalShares += purchase.shares;
            totalExchangeRateWeighted += purchase.shares * purchase.exchangeRate;
          });
          weightedExchangeRate = totalShares > 0 ? totalExchangeRateWeighted / totalShares : 1;
        }
        valueInEUR = valueInBaseCurrency * weightedExchangeRate;
      }
      totalValue += valueInEUR;
    } else {
      totalValue += position.totalCost;
    }
  });
  const companiesCount = Object.keys(activePositions).length;
  const activePositionKeys = new Set(Object.keys(activePositions));
  const activeOperations = operations.filter(op => {
    const opKey = op.symbol ? `${op.company}|||${op.symbol}` : op.company;
    return activePositionKeys.has(opKey);
  });
  const totalOperations = activeOperations.length;
  const totalShares = Object.values(activePositions).reduce((sum, pos) => sum + pos.shares, 0);
  return { totalValue, companiesCount, totalOperations, totalShares };
};

