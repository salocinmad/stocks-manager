/**
 * Script maestro de migración a tablas globales
 * Ejecuta todas las migraciones en orden
 */

import '../config/database.js';
import PriceCache from '../models/PriceCache.js';
import DailyPrice from '../models/DailyPrice.js';
import Operation from '../models/Operation.js';
import GlobalCurrentPrice from '../models/GlobalCurrentPrice.js';
import GlobalStockPrice from '../models/GlobalStockPrice.js';
import UserStockAlert from '../models/UserStockAlert.js';
import { Op } from 'sequelize';
import { getPreviousMarketDay } from '../utils/dateHelpers.js';
import { getSymbolFromPositionKey } from '../utils/symbolHelpers.js';

/**
 * Migra PriceCache → GlobalCurrentPrices
 */
async function migratePriceCache() {
    console.log('\n1️⃣  Migrando PriceCache → GlobalCurrentPrices...');

    const caches = await PriceCache.findAll();
    const symbolsMap = new Map();

    // Agrupar por símbolo, tomando el más reciente
    for (const cache of caches) {
        const symbol = getSymbolFromPositionKey(cache.positionKey);
        if (!symbol) continue;

        if (!symbolsMap.has(symbol) || cache.updatedAt > symbolsMap.get(symbol).cache.updatedAt) {
            symbolsMap.set(symbol, { cache, symbol });
        }
    }

    let migrated = 0;
    for (const [symbol, { cache }] of symbolsMap.entries()) {
        const [record, created] = await GlobalCurrentPrice.findOrCreate({
            where: { symbol },
            defaults: {
                lastPrice: cache.lastPrice,
                change: cache.change,
                changePercent: cache.changePercent,
                previousClose: cache.lastPrice - (cache.change || 0),
                previousCloseDate: getPreviousMarketDay(),
                source: cache.source || 'unknown',
                updatedAt: cache.updatedAt,
                createdAt: cache.createdAt
            }
        });

        if (created) migrated++;
    }

    console.log(`✅ Migrados ${migrated} símbolos a GlobalCurrentPrices`);
    return migrated;
}

/**
 * Migra DailyPrice → GlobalStockPrices
 */
async function migrateDailyPrice() {
    console.log('\n2️⃣  Migrando DailyPrice → GlobalStockPrices...');

    const dailyPrices = await DailyPrice.findAll();
    const uniqueMap = new Map();

    // Agrupar por (symbol, date), tomando el más reciente
    for (const dp of dailyPrices) {
        if (!dp.symbol) continue;

        const key = `${dp.symbol}|||${dp.date}`;
        if (!uniqueMap.has(key) || dp.updatedAt > uniqueMap.get(key).updatedAt) {
            uniqueMap.set(key, dp);
        }
    }

    let migrated = 0;
    for (const [key, dp] of uniqueMap.entries()) {
        const [record, created] = await GlobalStockPrice.findOrCreate({
            where: { symbol: dp.symbol, date: dp.date },
            defaults: {
                open: dp.open,
                high: dp.high,
                low: dp.low,
                close: dp.close,
                change: dp.change,
                changePercent: dp.changePercent,
                source: dp.source || 'yahoo'
            }
        });

        if (created) migrated++;
    }

    console.log(`✅ Migrados ${migrated} registros históricos`);
    return migrated;
}

/**
 * Migra targetPrice → UserStockAlerts
 */
async function migrateAlerts() {
    console.log('\n3️⃣  Migrando targetPrice → UserStockAlerts...');

    // Buscar operaciones con targetPrice
    const operationsWithTarget = await Operation.findAll({
        where: { targetPrice: { [Op.not]: null } }
    });

    let migrated = 0;
    for (const op of operationsWithTarget) {
        if (!op.symbol) continue;

        const [alert, created] = await UserStockAlert.findOrCreate({
            where: {
                userId: op.userId,
                portfolioId: op.portfolioId,
                symbol: op.symbol
            },
            defaults: {
                targetPrice: op.targetPrice
            }
        });

        if (created) migrated++;
    }

    console.log(`✅ Migradas ${migrated} alertas`);
    return migrated;
}

/**
 * Ejecuta migración completa
 */
async function runMigration() {
    console.log('\n🔄 MIGRACIÓN A TABLAS GLOBALES');
    console.log('='.repeat(60));

    try {
        const stats = {
            currentPrices: await migratePriceCache(),
            historicalPrices: await migrateDailyPrice(),
            alerts: await migrateAlerts()
        };

        console.log('\n' + '='.repeat(60));
        console.log('✅ MIGRACIÓN COMPLETADA');
        console.log(` - GlobalCurrentPrices: ${stats.currentPrices}`);
        console.log(` - GlobalStockPrices: ${stats.historicalPrices}`);
        console.log(` - UserStockAlerts: ${stats.alerts}`);
        console.log('='.repeat(60));

        return stats;
    } catch (error) {
        console.error('\n❌ Error en migración:', error);
        throw error;
    }
}

// Ejecutar si es script principal
if (import.meta.url === `file://${process.argv[1]}`) {
    runMigration()
        .then(() => {
            console.log('\n✅ Migración exitosa');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Migración fallida:', error);
            process.exit(1);
        });
}

export default runMigration;
