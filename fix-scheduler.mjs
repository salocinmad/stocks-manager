import fs from 'fs';

const filePath = './server/services/scheduler.js';
let content = fs.readFileSync(filePath, 'utf8');

// Eliminar las líneas 34-35 que están duplicadas
content = content.replace(/}\n  }\n}\n\nconst fetchPriceFinnhub/g, '}\n\nconst fetch

PriceYahoo = async (symbol) => {
    \n  try {
    \n    if (!symbol) return null\n    const quote = await yahooFinance.quote(symbol) \n    const price = quote?.regularMarketPrice || quote?.postMarketPrice || quote?.preMarketPrice\n    \n    // Intentar obtener change y changePercent de Yahoo\n    let change = quote?.regularMarketChange\n    let changePercent = quote?.regularMarketChangePercent\n    \n    // Si Yahoo no proporciona change/changePercent, calcularlos manualmente\n    const previousClose = quote?.regularMarketPreviousClose || quote?.previousClose\n    if ((change === null || change === undefined) && price && previousClose) {\n      change = price - previousClose\n      console.log(`📊 Yahoo ${symbol}: Change calculado manualmente = ${change}`)\n    }\n    \n    if ((changePercent === null || changePercent === undefined) && change !== null && previousClose && previousClose > 0) {\n      changePercent = (change / previousClose) * 100\n      console.log(`📊 Yahoo ${symbol}: ChangePercent calculado manualmente = ${changePercent}%`)\n    }\n\n    if (!price || price <= 0) return null\n    return { price, change, changePercent }\n  } catch {\n    return null\n  }\n}\n\nconst fetchPriceFinnhub');

        fs.writeFileSync(filePath, content, 'utf8');
        console.log('✅ scheduler.js corregido');
