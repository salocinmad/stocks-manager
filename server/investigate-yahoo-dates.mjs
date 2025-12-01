import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({
    suppressNotices: ['yahooSurvey'],
    queue: {
        concurrency: 1,
        timeout: 300
    }
});

async function investigateYahooFields() {
    const symbols = ['AAPL', 'AMP.MC'];

    for (const symbol of symbols) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`INVESTIGANDO: ${symbol}`);
        console.log('='.repeat(60));

        try {
            // 1. quote() - Cotización actual
            console.log('\n📊 1. QUOTE (Cotización actual):');
            const quote = await yahooFinance.quote(symbol);

            console.log('\n🔍 Campos relacionados con fechas y precios:');
            console.log('regularMarketPrice:', quote.regularMarketPrice);
            console.log('regularMarketPreviousClose:', quote.regularMarketPreviousClose);
            console.log('regularMarketTime:', quote.regularMarketTime);
            console.log('regularMarketDayHigh:', quote.regularMarketDayHigh);
            console.log('regularMarketDayLow:', quote.regularMarketDayLow);
            console.log('regularMarketOpen:', quote.regularMarketOpen);
            console.log('regularMarketChange:', quote.regularMarketChange);
            console.log('regularMarketChangePercent:', quote.regularMarketChangePercent);

            if (quote.regularMarketTime) {
                const date = new Date(quote.regularMarketTime * 1000);
                console.log('\nregularMarketTime convertido:', date.toISOString());
                console.log('Fecha local:', date.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }));
            }

            // 2. historical() - Últimos 5 días
            console.log('\n\n📈 2. HISTORICAL (Últimos 5 días):');
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);

            const historical = await yahooFinance.historical(symbol, {
                period1: startDate.toISOString().split('T')[0],
                period2: endDate.toISOString().split('T')[0],
            });

            console.log(`\nEncontrados ${historical.length} registros históricos:`);
            historical.slice(0, 5).forEach(h => {
                console.log(`\nFecha: ${h.date.toISOString().split('T')[0]}`);
                console.log(`  Open: ${h.open}, High: ${h.high}, Low: ${h.low}`);
                console.log(`  Close: ${h.close}, Volume: ${h.volume}`);
                console.log(`  AdjClose: ${h.adjClose}`);
            });

            // 3. chart() - Alternativa más completa
            console.log('\n\n📊 3. CHART (Datos de gráfico):');
            const chart = await yahooFinance.chart(symbol, {
                period1: startDate.toISOString().split('T')[0],
                interval: '1d'
            });

            console.log('\nMeta del chart:');
            console.log('currency:', chart.meta.currency);
            console.log('exchangeName:', chart.meta.exchangeName);
            console.log('regularMarketPrice:', chart.meta.regularMarketPrice);
            console.log('previousClose:', chart.meta.previousClose);
            console.log('regularMarketTime:', new Date(chart.meta.regularMarketTime * 1000).toISOString());

            if (chart.quotes && chart.quotes.length > 0) {
                console.log(`\nPrimeros 3 quotes del chart:`);
                chart.quotes.slice(0, 3).forEach(q => {
                    if (q.date) {
                        console.log(`\nFecha: ${q.date.toISOString().split('T')[0]}`);
                        console.log(`  Open: ${q.open}, High: ${q.high}, Low: ${q.low}, Close: ${q.close}`);
                    }
                });
            }

        } catch (error) {
            console.error(`❌ Error con ${symbol}:`, error.message);
        }
    }

    console.log('\n\n' + '='.repeat(60));
    console.log('CONCLUSIONES:');
    console.log('='.repeat(60));
    console.log('1. quote.regularMarketTime → Timestamp del precio actual (Unix epoch)');
    console.log('2. quote.regularMarketPreviousClose → Precio del cierre anterior (sin fecha explícita)');
    console.log('3. historical() → Devuelve array con {date, open, high, low, close, volume}');
    console.log('4. chart() → Similar a historical pero con más metadata');
    console.log('\n💡 Para obtener previousClose con fecha:');
    console.log('   - Usar historical() y tomar el close del día anterior');
    console.log('   - O calcular: si regularMarketTime es 2024-11-28, previousClose es del 2024-11-27');
}

investigateYahooFields().catch(console.error);
