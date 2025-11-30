#!/usr/bin/env node
/**
 * Script de verificación de imports
 * Detecta errores de inicio antes de ejecutar el servidor
 */

console.log('🔍 Verificando módulos del servidor...\n');

const checks = {
    passed: [],
    failed: []
};

async function checkModule(name, path) {
    try {
        await import(path);
        checks.passed.push(name);
        console.log(`✅ ${name}`);
        return true;
    } catch (error) {
        checks.failed.push({ name, error: error.message });
        console.error(`❌ ${name}: ${error.message}`);
        return false;
    }
}

async function runChecks() {
    console.log('📦 Utils:');
    await checkModule('constants', './utils/constants.js');
    await checkModule('dateHelpers', './utils/dateHelpers.js');
    await checkModule('symbolHelpers', './utils/symbolHelpers.js');
    await checkModule('exchangeRateService', './utils/exchangeRateService.js');

    console.log('\n📊 Models:');
    await checkModule('GlobalCurrentPrice', './models/GlobalCurrentPrice.js');
    await checkModule('GlobalStockPrice', './models/GlobalStockPrice.js');
    await checkModule('UserStockAlert', './models/UserStockAlert.js');

    console.log('\n🔌 Datasources:');
    await checkModule('yahooFinanceInstance', './services/datasources/yahooFinanceInstance.js');
    await checkModule('finnhubService', './services/datasources/finnhubService.js');
    await checkModule('yahooService', './services/datasources/yahooService.js');
    await checkModule('priceCombinaService', './services/datasources/priceCombinaService.js');

    console.log('\n💲 Price Services:');
    await checkModule('currentPriceService', './services/prices/currentPriceService.js');
    await checkModule('historicalPriceService', './services/prices/historicalPriceService.js');

    console.log('\n⏰ Scheduler:');
    await checkModule('priceScheduler', './services/scheduler/priceScheduler.js');
    await checkModule('scheduler (wrapper)', './services/scheduler.js');

    console.log('\n🌐 API Routes:');
    await checkModule('prices API', './routes/api/prices.js');

    console.log('\n' + '='.repeat(60));
    console.log(`\n✅ Passed: ${checks.passed.length}`);
    console.log(`❌ Failed: ${checks.failed.length}`);

    if (checks.failed.length > 0) {
        console.log('\n⚠️  ERRORES ENCONTRADOS:\n');
        checks.failed.forEach(({ name, error }) => {
            console.log(`   ${name}:`);
            console.log(`   → ${error}\n`);
        });
        process.exit(1);
    } else {
        console.log('\n🎉 Todos los módulos se importan correctamente');
        process.exit(0);
    }
}

runChecks().catch(error => {
    console.error('\n❌ Error crítico:', error);
    process.exit(1);
});
