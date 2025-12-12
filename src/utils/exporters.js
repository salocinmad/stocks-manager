import { formatPrice, formatNumberForCSV, formatExchangeRate } from './formatters.js';

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
    'Precio $ ven',
    'Ganancia en €',
    'Porcentaje',
    'Rentenciones',
    'Retencion',
    '% Retencion',
    'Ganancia real'
  ]);

  sales.forEach(sale => {
    const company = sale.company;
    const companyPurchases = operations
      .filter(op => op.company === company && op.type === 'purchase')
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    let remainingShares = sale.shares;
    let totalPurchaseCost = 0; // Acumula el costo total de las compras en EUR.
    let totalPurchaseCostOriginalCurrency = 0; // Acumula el costo total de las compras en la moneda original.
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
      totalPurchaseCost += sharesToUse * costPerShare; // Acumula el costo en EUR.
      totalPurchaseCostOriginalCurrency += sharesToUse * purchase.price; // Acumula el costo en la moneda original.
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
    avgPurchaseExchangeRate = totalPurchaseShares > 0 ? avgPurchaseExchangeRate / totalPurchaseShares : 1;

    // Asegurar que avgPurchaseExchangeRate sea un número válido
    if (!avgPurchaseExchangeRate || isNaN(avgPurchaseExchangeRate)) {
      avgPurchaseExchangeRate = 1;
    }

    const purchaseExchangeRate = purchaseCurrency === 'EUR' ? 1 : avgPurchaseExchangeRate;

    let avgPurchaseDate = '';
    if (purchaseDates.length > 0) {
      const dates = purchaseDates.map(date => new Date(date));
      const avgTimestamp = dates.reduce((sum, date) => sum + date.getTime(), 0) / dates.length;
      const avgDate = new Date(avgTimestamp);
      avgPurchaseDate = `${avgDate.getDate().toString().padStart(2, '0')}/${(avgDate.getMonth() + 1).toString().padStart(2, '0')}/${avgDate.getFullYear()}`;
    }

    // Validar exchangeRate de venta
    let saleExchangeRate = sale.currency === 'EUR' ? 1 : (sale.exchangeRate || 1);
    if (isNaN(saleExchangeRate) || !saleExchangeRate) {
      saleExchangeRate = 1;
    }

    const precioVenOriginalCurrency = (sale.shares || 0) * (sale.price || 0);

    const precioEnEuroVen = (precioVenOriginalCurrency - (sale.commission || 0)) * saleExchangeRate;

    const gananciasOriginalCurrency = precioVenOriginalCurrency - totalPurchaseCostOriginalCurrency;

    const gananciaEnEuro = precioEnEuroVen - totalPurchaseCost;
    const porcentajeGanancia = totalPurchaseCostOriginalCurrency > 0 ? (gananciasOriginalCurrency / totalPurchaseCostOriginalCurrency) * 100 : 0;

    const retencionPorcentaje = gananciaEnEuro > 0 ? 0.19 : 0;
    const retencionCalculada = gananciaEnEuro * retencionPorcentaje;
    const gananciaReal = gananciaEnEuro - retencionCalculada;

    const saleDate = new Date(sale.date);
    const formattedDate = `${saleDate.getDate().toString().padStart(2, '0')}/${(saleDate.getMonth() + 1).toString().padStart(2, '0')}/${saleDate.getFullYear()}`;



    csvRows.push([
      company, // Campo: Empresa
      avgPurchaseDate, // Campo: Fecha de compra promedio
      formattedDate, // Campo: Fecha de venta formateada
      sale.shares.toString(), // Campo: Títulos vendidos
      // `${formatNumberForCSV(totalPurchaseCostOriginalCurrency + totalPurchaseCommission)} ${purchaseCurrency}`, // Fórmula: (Títulos comprados * Precio de compra) + Comision com y Moneda de compra - precio con moneda
      formatNumberForCSV(totalPurchaseCostOriginalCurrency + totalPurchaseCommission), // Fórmula: (Títulos comprados * Precio de compra) + Comision com
      formatExchangeRate(purchaseExchangeRate), // Campo: Tipo de cambio de compra formateado
      // `${formatNumberForCSV(totalPurchaseCommission)} ${purchaseCurrency}`, // Campo: Comisión de compra total y Moneda de compra - precio con moneda
      formatNumberForCSV(totalPurchaseCommission), // Campo: Comisión de compra total
      // `${formatNumberForCSV(totalPurchaseCostOriginalCurrency * purchaseExchangeRate)} EUR`, // Fórmula: Precio com * Precio $ com - precio con moneda
      formatNumberForCSV(totalPurchaseCostOriginalCurrency * purchaseExchangeRate), // Fórmula: Precio com * Precio $ com
      // `${formatNumberForCSV(sale.price)} ${sale.currency}`, // Campo: Precio por acción de venta y Moneda de venta - precio con moneda
      formatNumberForCSV(sale.price), // Campo: Precio por acción de venta
      // `${formatNumberForCSV(precioVenOriginalCurrency)} ${sale.currency}`, // Fórmula: (Títulos vendidos * Precio por acción de venta) + Comision ven - precio con moneda
      formatNumberForCSV(precioVenOriginalCurrency), // Fórmula: (Títulos vendidos * Precio por acción de venta) + Comision ven
      // `${formatNumberForCSV(sale.commission)} ${sale.currency}`, // Campo: Comisión de venta y Moneda de venta - precio con moneda
      formatNumberForCSV(sale.commission), // Campo: Comisión de venta
      // `${formatNumberForCSV(precioEnEuroVen)} EUR`, // Fórmula: (Precio Ven - Comision ven) * Precio $ ven - precio con moneda
      formatNumberForCSV(precioEnEuroVen), // Fórmula: (Precio Ven - Comision ven) * Precio $ ven
      // `${formatNumberForCSV(gananciasOriginalCurrency)} ${sale.currency}`, // Fórmula: Precio Ven - Precio com - precio con moneda
      formatNumberForCSV(gananciasOriginalCurrency), // Fórmula: Precio Ven - Precio com
      formatExchangeRate(saleExchangeRate), // Campo: Tipo de cambio de venta formateado
      // `${formatNumberForCSV(gananciaEnEuro)} EUR`, // Fórmula: Precio en € ven - Precio en € com - precio con moneda
      formatNumberForCSV(gananciaEnEuro), // Fórmula: Precio en € ven - Precio en € com
      `${formatNumberForCSV(porcentajeGanancia)}%`, // Fórmula: ((Precio Ven - Precio com) / Precio com) * 100 y símbolo %
      'NO', // Campo: Retenciones (indicador)
      // `${formatNumberForCSV(retencionCalculada)} EUR`, // Fórmula: Ganancia en € * % Retencion - precio con moneda
      formatNumberForCSV(retencionCalculada), // Fórmula: Ganancia en € * % Retencion
      `${formatNumberForCSV(retencionPorcentaje * 100)}%`, // Fórmula: 19% si Ganancia en € es positivo o 0% si es negativo
      // `${formatNumberForCSV(gananciaReal)} EUR` // Fórmula: Ganancia en € * 100% - % Retencion - precio con moneda
      formatNumberForCSV(gananciaReal) // Fórmula: Ganancia en € * 100% - % Retencion
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
