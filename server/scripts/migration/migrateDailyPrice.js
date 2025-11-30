/**
 * Migración: DailyPrice → GlobalStockPrices
 * Consolida históricos por (símbolo, fecha) eliminando duplicados por usuario
 */

import '../config/database.js';
import DailyPrice from '../models/DailyPrice.js';
import GlobalStockPrice from '../models/GlobalStockPrice.js';

async function migrateDailyPrice() {
    console.log('\n📈 Migrando DailyPrice → GlobalStockPrices...');
    console.log('='.repeat(60));

    try {
        // Obtener todos los registros de DailyPrice
        const dailyPrices = await DailyPrice.findAll({
            where: {
                symbol: { $ne: null, $ne: '' }
            },
            order: [['date', 'DESC'], ['updatedAt', 'DESC']]
        });

        if (dailyPrices.length === 0) {
            console.log('⚠️  No hay registros en DailyPrice para migrar');
            return { migrated: 0, skipped: 0 };
        }

        console.log(`📦 Encontrados ${dailyPrices.length} registros en DailyPrice`);

        // Agrupar por (símbolo, fecha), tomando el más reciente
        const uniqueMap = new Map();

        for (const dp of dailyPrices) {
            const key = `${dp.symbol}|||${dp.date}`;

            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, dp);
            } else {
                const existing = uniqueMap.get(key);
                if (dp.updatedAt > existing.updatedAt) {
                    uniqueMap.set(key, dp);
                }
            }
        }

        console.log(`🔢 ${uniqueMap.size} registros únicos (símbolo+fecha)`);

        // Migrar cada registro
        let migrated = 0;
        let skipped = 0;
        let batchSize = 100;
        let batch = [];

        for (const [key, dp] of uniqueMap.entries()) {
            try {
                // Verificar si ya existe
                const existing = await GlobalStockPrice.findOne({
                    where: { symbol: dp.symbol, date: dp.date }
                });

                if (existing) {
                    skipped++;
                    if (skipped % 100 === 0) {
                        console.log(`⏭️  Omitidos: ${skipped}...`);
                    }
                    continue;
                }

                // Preparar para batch insert
                batch.push({
                    symbol: dp.symbol,
                    date: dp.date,
                    open: dp.open,
                    high: dp.high,
                    low: dp.low,
                    close: dp.close,
                    volume: dp.volume || null,
                    change: dp.change,
                    changePercent: dp.changePercent,
                    source: dp.source || 'migrated',
                    createdAt: dp.createdAt,
                    updatedAt: dp.updatedAt
                });

                // Insertar en batches
                if (batch.length >= batchSize) {
                    await GlobalStockPrice.bulkCreate(batch, { ignoreDuplicates: true });
                    migrated += batch.length;
                    console.log(`✅ Migrados: ${migrated}...`);
                    batch = [];
                }

            } catch (error) {
                console.error(`❌ Error migrando ${dp.symbol} ${dp.date}:`, error.message);
            }
        }

        // Insertar batch restante
        if (batch.length > 0) {
            await GlobalStockPrice.bulkCreate(batch, { ignoreDuplicates: true });
            migrated += batch.length;
        }

        console.log('\n' + '='.repeat(60));
        console.log(`✅ Migración completada:`);
        console.log(`   - Migrados: ${migrated}`);
        console.log(`   - Omitidos: ${skipped}`);
        console.log(`   - Total registros: ${uniqueMap.size}`);
        console.log('='.repeat(60));

        return { migrated, skipped, total: uniqueMap.size };

    } catch (error) {
        console.error('\n❌ Error en migración:', error);
        throw error;
    }
}

// Ejecutar si es script principal
if (import.meta.url === `file://${process.argv[1]}`) {
    migrateDailyPrice()
        .then(result => {
            console.log(`\n✅ Migración exitosa: ${result.migrated} registros`);
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Migración fallida:', error);
            process.exit(1);
        });
}

export default migrateDailyPrice;
