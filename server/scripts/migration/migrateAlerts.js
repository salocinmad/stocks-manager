/**
 * Migración: targetPrice de Operations → UserStockAlerts
 * Extrae configuración de alertas por usuario/portfolio/símbolo
 */

import '../config/database.js';
import Operation from '../models/Operation.js';
import PriceCache from '../models/PriceCache.js';
import UserStockAlert from '../models/UserStockAlert.js';
import { Op } from 'sequelize';
import { getSymbolFromPositionKey } from '../utils/symbolHelpers.js';

async function migrateAlerts() {
    console.log('\n🔔 Migrando targetPrice → UserStockAlerts...');
    console.log('='.repeat(60));

    try {
        // Buscar todas las operaciones con targetPrice
        const operationsWithTarget = await Operation.findAll({
            where: {
                targetPrice: { [Op.not]: null },
                symbol: { [Op.not]: null, [Op.not]: '' }
            },
            order: [['date', 'DESC']]
        });

        if (operationsWithTarget.length === 0) {
            console.log('⚠️  No hay operaciones con targetPrice');
        } else {
            console.log(`📦 Encontradas ${operationsWithTarget.length} operaciones con targetPrice`);
        }

        // Buscar registros en PriceCache con notificaciones
        const cachesWithNotifications = await PriceCache.findAll({
            where: {
                targetHitNotifiedAt: { [Op.not]: null }
            }
        });

        if (cachesWithNotifications.length === 0) {
            console.log('⚠️  No hay registros con notificaciones en PriceCache');
        } else {
            console.log(`📦 Encontrados ${cachesWithNotifications.length} registros con notificaciones`);
        }

        // Combinar información de ambas fuentes
        const alertsMap = new Map();

        // De Operations: targetPrice
        for (const op of operationsWithTarget) {
            const key = `${op.userId}|||${op.portfolioId}|||${op.symbol}`;

            if (!alertsMap.has(key)) {
                alertsMap.set(key, {
                    userId: op.userId,
                    portfolioId: op.portfolioId,
                    symbol: op.symbol,
                    targetPrice: op.targetPrice,
                    targetHitNotifiedAt: null,
                    source: 'operation'
                });
            }
        }

        // De PriceCache: targetHitNotifiedAt
        for (const cache of cachesWithNotifications) {
            const symbol = getSymbolFromPositionKey(cache.positionKey);
            if (!symbol) continue;

            const key = `${cache.userId}|||${cache.portfolioId}|||${symbol}`;

            if (alertsMap.has(key)) {
                // Combinar con existente
                const alert = alertsMap.get(key);
                alert.targetHitNotifiedAt = cache.targetHitNotifiedAt;
                alert.source = 'combined';
            } else {
                // Crear nuevo (solo notificación, sin targetPrice)
                alertsMap.set(key, {
                    userId: cache.userId,
                    portfolioId: cache.portfolioId,
                    symbol,
                    targetPrice: null,
                    targetHitNotifiedAt: cache.targetHitNotifiedAt,
                    source: 'cache'
                });
            }
        }

        console.log(`🔢 ${alertsMap.size} alertas únicas encontradas`);

        // Migrar cada alerta
        let migrated = 0;
        let skipped = 0;

        for (const [key, alertData] of alertsMap.entries()) {
            try {
                const { userId, portfolioId, symbol, targetPrice, targetHitNotifiedAt, source } = alertData;

                // Verificar si ya existe
                const existing = await UserStockAlert.findOne({
                    where: { userId, portfolioId, symbol }
                });

                if (existing) {
                    console.log(`⏭️  ${symbol} (user ${userId}): Ya existe, omitiendo`);
                    skipped++;
                    continue;
                }

                // Crear nueva alerta
                await UserStockAlert.create({
                    userId,
                    portfolioId,
                    symbol,
                    targetPrice,
                    targetHitNotifiedAt
                });

                console.log(`✅ ${symbol} (user ${userId}): targetPrice=${targetPrice || 'N/A'} (${source})`);
                migrated++;

            } catch (error) {
                console.error(`❌ Error migrando alerta:`, error.message);
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log(`✅ Migración completada:`);
        console.log(`   - Migradas: ${migrated}`);
        console.log(`   - Omitidas: ${skipped}`);
        console.log(`   - Total alertas: ${alertsMap.size}`);
        console.log('='.repeat(60));

        return { migrated, skipped, total: alertsMap.size };

    } catch (error) {
        console.error('\n❌ Error en migración:', error);
        throw error;
    }
}

// Ejecutar si es script principal
if (import.meta.url === `file://${process.argv[1]}`) {
    migrateAlerts()
        .then(result => {
            console.log(`\n✅ Migración exitosa: ${result.migrated} alertas`);
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Migración fallida:', error);
            process.exit(1);
        });
}

export default migrateAlerts;
