import { formatPrice } from './formatters.js';

export const generateFullCSV = (operations) => {
  const sales = operations.filter(op => op.type === 'sale');

  if (sales.length === 0) {
    alert('No hay operaciones de venta para generar el CSV');
    return;
  }

  const csvRows = [];

  csvRows.push([
    'Empresa',
    'Fecha Com',
    'Fecha Ven',
    'Títulos',
    'Precio com',
    'Precio $ com',
    'Comision com',
    'Precio en € com',
    'Accion ven',
    'Precio Ven',
    'Comision ven',
    'Precio en € ven',
    'Ganancias',
    'Precio $ ve',
    'Ganancia en €',
    'Porcentaje',
    'Rentenciones',
    'Retencion',
    '% Retencio',
    'Ganancia real'
  ]);

  sales.forEach(sale => {
    const company = sale.company;
    const companyPurchases = operations
      .filter(op => op.company === company && op.type === 'purchase')
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    let remainingShares = sale.shares;
    let totalPurchaseCost = 0;
    let totalPurchaseShares = 0;
    let totalPurchaseCommission = 0;
    let avgPurchasePrice = 0;
    let avgPurchaseExchangeRate = 0;
    let purchaseDates = [];
    let purchaseCurrencies = [];

    companyPurchases.forEach(purchase => {
      if (remainingShares <= 0) return;
      const sharesToUse = Math.min(remainingShares, purchase.shares);
      const costPerShare = purchase.totalCost / purchase.shares;
      totalPurchaseCost += sharesToUse * costPerShare;
      totalPurchaseShares += sharesToUse;
      totalPurchaseCommission += (purchase.commission / purchase.shares) * sharesToUse;

      for (let i = 0; i < sharesToUse; i++) {
        purchaseCurrencies.push(purchase.currency || 'EUR');
      }

      const purchaseExRate = purchase.currency === 'EUR' ? 1 : purchase.exchangeRate;
      avgPurchaseExchangeRate += purchaseExRate * sharesToUse;

      for (let i = 0; i < sharesToUse; i++) {
        purchaseDates.push(purchase.date);
      }

      remainingShares -= sharesToUse;
    });

    let purchaseCurrency = 'EUR';
    if (purchaseCurrencies.length > 0) {
      const eurCount = purchaseCurrencies.filter(c => c === 'EUR').length;
      if (eurCount === purchaseCurrencies.length) {
        purchaseCurrency = 'EUR';
      } else {
        const currencyCounts = {};
        purchaseCurrencies.forEach(c => {
          currencyCounts[c] = (currencyCounts[c] || 0) + 1;
        });
        purchaseCurrency = Object.keys(currencyCounts).reduce((a, b) =>
          currencyCounts[a] > currencyCounts[b] ? a : b
        );
      }
    }

    avgPurchasePrice = totalPurchaseShares > 0 ? totalPurchaseCost / totalPurchaseShares : 0;
    avgPurchaseExchangeRate = totalPurchaseShares > 0 ? avgPurchaseExchangeRate / totalPurchaseShares : 0;

    const purchaseExchangeRate = purchaseCurrency === 'EUR' ? 1 : avgPurchaseExchangeRate;

    let avgPurchaseDate = '';
    if (purchaseDates.length > 0) {
      const dates = purchaseDates.map(date => new Date(date));
      const avgTimestamp = dates.reduce((sum, date) => sum + date.getTime(), 0) / dates.length;
      const avgDate = new Date(avgTimestamp);
      avgPurchaseDate = `${avgDate.getDate().toString().padStart(2, '0')}/${(avgDate.getMonth() + 1).toString().padStart(2, '0')}/${avgDate.getFullYear()}`;
    }

    const saleExchangeRate = sale.currency === 'EUR' ? 1 : (sale.exchangeRate || 1);

    const saleRevenue = sale.shares * sale.price * saleExchangeRate;
    const saleCommission = sale.commission * saleExchangeRate;
    const netSaleRevenue = saleRevenue - saleCommission;

    const grossProfit = netSaleRevenue - totalPurchaseCost;
    const profitPercentage = totalPurchaseCost > 0 ? (grossProfit / totalPurchaseCost) * 100 : 0;

    const retentionRate = 0.19;
    const retention = grossProfit > 0 ? grossProfit * retentionRate : 0;
    const netProfit = grossProfit - retention;

    const saleDate = new Date(sale.date);
    const formattedDate = `${saleDate.getDate().toString().padStart(2, '0')}/${(saleDate.getMonth() + 1).toString().padStart(2, '0')}/${saleDate.getFullYear()}`;

    const formatExchangeRate = (rate) => rate === 1 ? '1' : rate.toFixed(8);

    csvRows.push([
      company,
      avgPurchaseDate,
      formattedDate,
      sale.shares.toString(),
      `${formatPrice(avgPurchasePrice)} ${purchaseCurrency}`,
      formatExchangeRate(purchaseExchangeRate),
      `${totalPurchaseCommission.toFixed(2)} ${purchaseCurrency}`,
      `${totalPurchaseCost.toFixed(2)} EUR`,
      `${formatPrice(sale.price)} ${sale.currency}`,
      `${(sale.shares * sale.price).toFixed(2)} ${sale.currency}`,
      `${sale.commission.toFixed(2)} ${sale.currency}`,
      `${netSaleRevenue.toFixed(2)} EUR`,
      `${(sale.shares * sale.price - sale.commission - (totalPurchaseCost / purchaseExchangeRate)).toFixed(2)} ${sale.currency}`,
      formatExchangeRate(saleExchangeRate),
      `${grossProfit.toFixed(2)} EUR`,
      `${profitPercentage.toFixed(2)}%`,
      'NO',
      `${retention.toFixed(2)} EUR`,
      '19%',
      `${netProfit.toFixed(2)} €`
    ]);
  });

  const csvContent = '\uFEFF' + csvRows.map(row =>
    row.map(cell => {
      const escapedCell = cell.toString().replace(/"/g, '""');
      if (escapedCell.includes(',') || escapedCell.includes('"') || escapedCell.includes('\n') || escapedCell.includes('\r')) {
        return `"${escapedCell}"`;
      }
      return escapedCell;
    }).join(';')
  ).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `operaciones_portfolio_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
