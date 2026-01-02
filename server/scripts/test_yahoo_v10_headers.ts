/**
 * Test V10 con diferentes configuraciones de headers
 */

const TICKER = 'AAPL';

console.log('='.repeat(60));
console.log('🧪 TEST YAHOO V10 CON DIFERENTES HEADERS');
console.log('='.repeat(60));

// Test 1: Sin headers
async function test1() {
    console.log('\n📋 Test 1: Sin headers extra');
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${TICKER}?modules=financialData`;
    const resp = await fetch(url);
    console.log(`   Status: ${resp.status}`);
}

// Test 2: Con User-Agent básico
async function test2() {
    console.log('\n📋 Test 2: Con User-Agent básico');
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${TICKER}?modules=financialData`;
    const resp = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    console.log(`   Status: ${resp.status}`);
}

// Test 3: Con cookie de crumb (como hace yahoo-finance2)
async function test3() {
    console.log('\n📋 Test 3: Yahoo-finance2 library');
    try {
        const YahooFinance = await import('yahoo-finance2');
        const yf = new YahooFinance.default();

        const result = await yf.quoteSummary(TICKER, { modules: ['financialData'] });

        if (result.financialData) {
            console.log('   ✅ OK via yahoo-finance2');
            console.log(`   - recommendationKey: ${result.financialData.recommendationKey}`);
            console.log(`   - targetMeanPrice: ${result.financialData.targetMeanPrice}`);
            console.log(`   - numberOfAnalystOpinions: ${result.financialData.numberOfAnalystOpinions}`);
        } else {
            console.log('   ⚠️ No financialData');
        }
    } catch (e: any) {
        console.log(`   ❌ Error: ${e.message}`);
    }
}

// Test 4: Verificar qué devuelve V8 en meta (puede incluir algunos datos)
async function test4() {
    console.log('\n📋 Test 4: V8 meta completo');
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${TICKER}?interval=1d&range=5d`;
    const resp = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });

    if (resp.ok) {
        const data = await resp.json();
        const meta = data.chart?.result?.[0]?.meta;
        console.log('   ✅ V8 meta keys:', Object.keys(meta || {}));
    }
}

// Test 5: Yahoo Insights API (alternativa)
async function test5() {
    console.log('\n📋 Test 5: Yahoo Insights API');
    const url = `https://query1.finance.yahoo.com/ws/insights/v1/finance/insights?symbol=${TICKER}`;
    const resp = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    console.log(`   Status: ${resp.status}`);
    if (resp.ok) {
        const data = await resp.json();
        console.log('   ✅ Insights disponibles:', !!data.finance?.result);
    }
}

async function runAll() {
    await test1();
    await test2();
    await test3();
    await test4();
    await test5();
    console.log('\n' + '='.repeat(60));
}

runAll().catch(console.error);
