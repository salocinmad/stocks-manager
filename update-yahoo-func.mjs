import fs from 'fs';

const filePath = './server/services/scheduler.js';
let content = fs.readFileSync(filePath, 'utf8');

// Buscar la función fetchPriceYahoo
const oldFunction = `const fetchPriceYahoo = async (symbol) => {
  try {
    if (!symbol) return null
    const quote = await yahooFinance.quote(symbol)
    const price = quote?.regularMarketPrice || quote?.postMarketPrice || quote?.preMarketPrice
    const change = quote?.regularMarketChange ?? null
    const changePercent = quote?.regularMarketChangePercent ?? null

    // Debug: Log para verificar que Yahoo devuelve estos campos
    if (change === null || changePercent === null) {
      console.log(\`⚠️ Yahoo \${symbol}: change=\${change}, changePercent=\${changePercent}\`)
    }

    if (!price || price <= 0) return null
    return { price, change, changePercent }
  } catch {
    return null
  }
}`;

const newFunction = `const fetchPriceYahoo = async (symbol) => {
  try {
    if (!symbol) return null
    const quote = await yahooFinance.quote(symbol)
    const price = quote?.regularMarketPrice || quote?.postMarketPrice || quote?.preMarketPrice
    
    // Intentar obtener change y changePercent de Yahoo
    let change = quote?.regularMarketChange
    let changePercent = quote?.regularMarketChangePercent
    
    // Si Yahoo no proporciona change/changePercent, calcularlos manualmente
    const previousClose = quote?.regularMarketPreviousClose || quote?.previousClose
    
    if ((change === null || change === undefined) && price && previousClose) {
      change = price - previousClose
      console.log(\`📊 Yahoo \${symbol}: Change calculado = \${change} (precio: \${price}, cierre anterior: \${previousClose})\`)
    }
    
    if ((changePercent === null || changePercent === undefined) && change !== null && change !== undefined && previousClose && previousClose > 0) {
      changePercent = (change / previousClose) * 100
      console.log(\`📊 Yahoo \${symbol}: ChangePercent calculado = \${changePercent.toFixed(2)}%\`)
    }

    if (!price || price <= 0) return null
    return { price, change, changePercent }
  } catch (error) {
    console.error(\`❌ Error fetching Yahoo \${symbol}:\`, error.message)
    return null
  }
}`;

if (content.includes(oldFunction)) {
    content = content.replace(oldFunction, newFunction);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ scheduler.js actualizado correctamente');
} else {
    console.log('❌ No se encontró la función antigua');
    console.log('Buscando variante con \\r\\n...');

    // Intentar con \\r\\n
    const oldFunctionCRLF = oldFunction.replace(/\n/g, '\r\n');
    const newFunctionCRLF = newFunction.replace(/\n/g, '\r\n');

    if (content.includes(oldFunctionCRLF)) {
        content = content.replace(oldFunctionCRLF, newFunctionCRLF);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('✅ scheduler.js actualizado correctamente (CRLF)');
    } else {
        console.log('❌ Tampoco se encontró con CRLF');
    }
}
