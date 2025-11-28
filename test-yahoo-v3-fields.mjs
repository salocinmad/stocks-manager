import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({
    suppressNotices: ['yahooSurvey'],
    queue: {
        concurrency: 1,
        timeout: 300
    }
});

async function testYahooFields() {
    const symbols = ['AMP.MC', 'AAPL'];

    for (const symbol of symbols) {
        console.log(`\n========== ${symbol} ==========`);
        try {
            const quote = await yahooFinance.quote(symbol);

            console.log('\n📊 Campos disponibles:');
            console.log('regularMarketPrice:', quote.regularMarketPrice);
            console.log('regularMarketChange:', quote.regularMarketChange);
            console.log('regularMarketChangePercent:', quote.regularMarketChangePercent);
            console.log('regularMarketPreviousClose:', quote.regularMarketPreviousClose);

            console.log('\n🔢 Cálculo manual:');
            if (quote.regularMarketPrice && quote.regularMarketPreviousClose) {
                const change = quote.regularMarketPrice - quote.regularMarketPreviousClose;
                const changePercent = (change / quote.regularMarketPreviousClose) * 100;
                console.log('Change calculado:', change);
                console.log('ChangePercent calculado:', changePercent);
            }

            console.log('\n📋 Todos los campos:');
            console.log(JSON.stringify(quote, null, 2));

        } catch (error) {
            console.error(`❌ Error con ${symbol}:`, error.message);
        }
    }
}

testYahooFields();
