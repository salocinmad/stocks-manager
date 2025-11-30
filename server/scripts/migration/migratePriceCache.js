/**
 * Migración: PriceCache → GlobalCurrentPrices
 * Consolida precios actuales por símbolo (elimina duplicados por usuario)
 */

import '../config/database.js';
import PriceCache from '../models/PriceCache.js';
import GlobalCurrentPrice from '../models/GlobalCurrentPrice.js';
import { getPreviousMarketDay } from '../utils/dateHelpers.js';
import { getSymbolFromPositionKey } from '../utils/symbolHelpers.js';

async function migratePriceCache() {
    console.log('\n📊 Migrando PriceCache → GlobalCurrentPrices...');
    console.log('='.repeat(60));

    try {
        // Obtener todos los registros de PriceCache
        const caches = await PriceCache.findAll({
            order: [['updatedAt', 'DESC']]
        });

        if (caches.length === 0) {
            console.log('⚠️  No hay registros en PriceCache para migrar');
            return { migrated: 0, skipped: 0 };
        }

        console.log(`📦 Encontrados ${caches.length} registros en PriceCache`);

        // Agrupar por símbolo, tomando el más reciente
        const symbolsMap = new Map();

        for (const cache of caches) {
            const symbol = getSymbolFromPositionKey(cache.positionKey);
            if (!symbol) {
                console.log(`⚠️  Registro sin símbolo válido: ${cache.positionKey}`);
                continue;
            }

            // Tomar el registro más reciente por símbolo
            if (!symbolsMap.has(symbol)) {
                symbolsMap.set(symbol, cache);
            } else {
                const existing = symbolsMap.get(symbol);
                if (cache.updatedAt > existing.updatedAt) {
                    symbolsMap.set(symbol, cache);
                }
            }
        }

        console.log(`🔢 ${symbolsMap.size} símbolos únicos encontrados`);

        // Migrar cada símbolo
        let migrated = 0;
        let skipped = 0;

        for (const [symbol, cache] of symbolsMap.entries()) {
            try {
                // Verificar si ya existe
                const existing = await GlobalCurrentPrice.findOne({ where: { symbol } });

                if (existing) {
                    console.log(`⏭️  ${symbol}: Ya existe, omitiendo`);
                    skipped++;
                    continue;
                }

                // Crear nuevo registro
                await GlobalCurrentPrice.create({
                    symbol,
                    lastPrice: cache.lastPrice,
                    change: cache.change,
                    changePercent: cache.changePercent,
                    previousClose: cache.lastPrice - (cache.change || 0),
                    previousCloseDate: getPreviousMarketDay(),
                    source: cache.source || 'migrated',
                    updatedAt: cache.updatedAt,
                    createdAt: cache.createdAt
                });

                console.log(`✅ ${symbol}: ${cache.lastPrice} (${cache.source || 'unknown'})`);
                migrated++;

            } catch (error) {
                console.error(`❌ Error migrando ${symbol}:`, error.message);
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log(`✅ Migración completada:`);
        console.log(`   - Migrados: ${migrated}`);
        console.log(`   - Omitidos: ${skipped}`);
        console.log(`   - Total símbolos: ${symbolsMap.size}`);
        console.log('='.repeat(60));

        return { migrated, skipped, total: symbolsMap.size };

    } catch (error) {
        console.error('\n❌ Error en migración:', error);
        throw error;
    }
}

// Ejecutar si es script principal
if (import.meta.url === `file://${process.argv[1]}`) {
    migratePriceCache()
        .then(result => {
            console.log(`\n✅ Migración exitosa: ${result.migrated} registros`);
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Migración fallida:', error);
            process.exit(1);
        });
}

export default migratePriceCache;
