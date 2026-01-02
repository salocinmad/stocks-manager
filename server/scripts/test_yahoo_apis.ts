/**
 * Test script para verificar Yahoo Finance V8 y V10 APIs
 * Ejecutar con: docker compose exec app bun run server/scripts/test_yahoo_apis.ts
 */

const TICKERS = ['AAPL', 'TEF.MC', 'MSFT']; // US y España

console.log('='.repeat(60));
console.log('🧪 TEST YAHOO FINANCE APIs');
console.log('='.repeat(60));

// ============================================================
// TEST 1: Yahoo V8 (Chart API - Precios)
// ============================================================
async function testYahooV8(ticker: string) {
    console.log(`\n📊 [V8] Testing ${ticker}...`);

    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            console.log(`   ❌ HTTP Error: ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();
        const meta = data.chart?.result?.[0]?.meta;

        if (!meta) {
            console.log('   ❌ No meta data in response');
            return null;
        }

        console.log('   ✅ V8 OK');
        console.log(`   - Precio: ${meta.regularMarketPrice} ${meta.currency}`);
        console.log(`   - Nombre: ${meta.longName || meta.shortName}`);
        console.log(`   - Estado: ${meta.marketState}`);
        console.log(`   - Exchange: ${meta.exchangeName}`);
        console.log(`   - 52w Low/High: ${meta.fiftyTwoWeekLow} / ${meta.fiftyTwoWeekHigh}`);

        return meta;
    } catch (e: any) {
        console.log(`   ❌ Error: ${e.message}`);
        return null;
    }
}

// ============================================================
// TEST 2: Yahoo V10 (Quote Summary - Fundamentales y Analistas)
// ============================================================
async function testYahooV10(ticker: string) {
    console.log(`\n📈 [V10] Testing ${ticker}...`);

    try {
        const modules = 'financialData,defaultKeyStatistics,calendarEvents,summaryDetail';
        const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=${modules}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            console.log(`   ❌ HTTP Error: ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();
        const result = data.quoteSummary?.result?.[0];

        if (!result) {
            console.log('   ❌ No result in response');
            return null;
        }

        console.log('   ✅ V10 OK');

        // Financial Data
        const fd = result.financialData;
        if (fd) {
            console.log(`   - Precio Objetivo: ${fd.targetMeanPrice?.fmt || 'N/A'}`);
            console.log(`   - Recomendación: ${fd.recommendationKey || 'N/A'}`);
            console.log(`   - Nº Analistas: ${fd.numberOfAnalystOpinions?.raw || 'N/A'}`);
        } else {
            console.log('   ⚠️ financialData no disponible');
        }

        // Summary Detail
        const sd = result.summaryDetail;
        if (sd) {
            console.log(`   - Market Cap: ${sd.marketCap?.fmt || 'N/A'}`);
            console.log(`   - P/E Ratio: ${sd.forwardPE?.fmt || sd.trailingPE?.fmt || 'N/A'}`);
            console.log(`   - Beta: ${sd.beta?.fmt || 'N/A'}`);
        } else {
            console.log('   ⚠️ summaryDetail no disponible');
        }

        // Calendar Events
        const ce = result.calendarEvents;
        if (ce?.earnings?.earningsDate?.[0]) {
            console.log(`   - Próx. Earnings: ${ce.earnings.earningsDate[0].fmt}`);
        }

        // Key Statistics
        const ks = result.defaultKeyStatistics;
        if (ks) {
            console.log(`   - Short Ratio: ${ks.shortRatio?.fmt || 'N/A'}`);
        }

        return {
            recommendationKey: fd?.recommendationKey,
            targetMeanPrice: fd?.targetMeanPrice?.fmt,
            numberOfAnalysts: fd?.numberOfAnalystOpinions?.raw,
            marketCap: sd?.marketCap?.fmt,
            peRatio: sd?.forwardPE?.fmt || sd?.trailingPE?.fmt,
            beta: sd?.beta?.fmt
        };
    } catch (e: any) {
        console.log(`   ❌ Error: ${e.message}`);
        return null;
    }
}

// ============================================================
// EJECUTAR TESTS
// ============================================================
async function runTests() {
    const results: any = { v8: {}, v10: {} };

    for (const ticker of TICKERS) {
        results.v8[ticker] = await testYahooV8(ticker);
        results.v10[ticker] = await testYahooV10(ticker);
    }

    // Resumen
    console.log('\n' + '='.repeat(60));
    console.log('📋 RESUMEN DE RESULTADOS');
    console.log('='.repeat(60));

    for (const ticker of TICKERS) {
        const v8ok = results.v8[ticker] !== null;
        const v10ok = results.v10[ticker] !== null;
        console.log(`${ticker}: V8 ${v8ok ? '✅' : '❌'} | V10 ${v10ok ? '✅' : '❌'}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🏁 TEST COMPLETADO');
    console.log('='.repeat(60));
}

runTests().catch(console.error);
