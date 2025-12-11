/**
 * Servicio de gestión de precios actuales
 * CRUD para GlobalCurrentPrices
 */

import { operations, globalCurrentPrices, assetProfiles } from '../../drizzle/schema.ts';
const schema = { operations, globalCurrentPrices, assetProfiles };
import { eq, and, inArray, isNotNull, ne, gt } from 'drizzle-orm';
import { fetchCombinedPrice } from '../datasources/priceCombinaService.js';
import { fetchAssetProfile } from '../datasources/yahooService.js';
import { getUniqueSymbols } from '../../utils/symbolHelpers.js';
import { getLogLevel } from '../configService.js';

/**
 * Actualiza precios de TODAS las acciones en uso
 * Usado por: scheduler automático y botón manual
 * @returns {Promise<Object>} Resumen de actualización
 */
export async function updateAllActivePrices(db, schema) {
    console.log('DEBUG: schema argument at start of updateAllActivePrices:', schema);
    console.log('DEBUG: db argument at start of updateAllActivePrices:', db);
    const currentLogLevel = await getLogLevel(db, eq, schema);

    console.log('DEBUG: eq before db.select in updateAllActivePrices:', eq);
    let operations;
    try {
        // 1. Obtener símbolos únicos EN USO
        operations = await db.select({ symbol: schema.operations.symbol })
            .from(schema.operations)
            .where(and(gt(schema.operations.shares, 0), isNotNull(schema.operations.symbol), ne(schema.operations.symbol, '')));
    } catch (error) {
        console.error('Error in db.select for operations:', error);
        throw error;
    }

    const symbols = getUniqueSymbols(operations);

    let updated = 0;
    let failed = 0;

    // 2. Actualizar cada símbolo
    for (const symbol of symbols) {
        try {
            const combined = await fetchCombinedPrice(symbol);

            if (!combined) {
                if (currentLogLevel === 'verbose') {
                    console.log(`⚠️  ${symbol}: Sin datos`);
                }
                continue;
            }

            // Limpiar regularMarketTime si existe (evitar timestamps incorrectos)
            if (combined.regularMarketTime) {
                const timestamp = combined.regularMarketTime;
                // Si es timestamp de Yahoo (segundos o milisegundos), convertir a Date
                if (typeof timestamp === 'number') {
                    // Determinar si son segundos o milisegundos
                    combined.regularMarketTime = timestamp > 946684800000
                        ? new Date(timestamp)  // Milisegundos
                        : new Date(timestamp * 1000);  // Segundos
                } else if (timestamp instanceof Date) {
                    // Ya es Date, verificar validez
                    if (isNaN(timestamp.getTime()) || timestamp.getFullYear() > 2100) {
                        combined.regularMarketTime = new Date();
                    }
                } else {
                    combined.regularMarketTime = new Date();
                }
            }

            // Guardar en GlobalCurrentPrice (escritura única por scheduler)
            await db.insert(schema.globalCurrentPrices)
                .values({ symbol, ...combined })
                .onConflictDoUpdate({
                    target: schema.globalCurrentPrices.symbol,
                    set: combined
                });

            if (currentLogLevel === 'verbose') {
                console.log(`✅ ${symbol}: ${combined.lastPrice} (${combined.source})`);
            }
            updated++;

            // 3. Actualizar Perfil del Activo
            await ensureAssetProfile(db, symbol, schema, currentLogLevel);

        } catch (error) {
            if (currentLogLevel === 'verbose') {
                console.error(`❌ ${symbol}:`, error.message);
            }
            failed++;
        }
    }

    return { updated, failed, total: symbols.length };
}

/**
 * Actualiza precio de un único símbolo (manual)
 * @param {string} symbol - Símbolo a actualizar
 * @returns {Promise<Object|null>} Datos actualizados o null
 */
export async function updateSinglePrice(db, symbol) {
    const currentLogLevel = await getLogLevel(db, eq, schema);
    try {
        const priceData = await fetchCombinedPrice(symbol);

        if (!priceData) {
            return null;
        }

        // Aplicar la misma limpieza de timestamp
        if (priceData.regularMarketTime) {
            const timestamp = priceData.regularMarketTime;
            if (typeof timestamp === 'number') {
                priceData.regularMarketTime = timestamp > 946684800000
                    ? new Date(timestamp)
                    : new Date(timestamp * 1000);
            } else if (timestamp instanceof Date && timestamp.getFullYear() > 2100) {
                priceData.regularMarketTime = new Date();
            }
        }

        await db.insert(schema.globalCurrentPrices)
                .values({ symbol, ...priceData })
                .onConflictDoUpdate({
                    target: schema.globalCurrentPrices.symbol,
                    set: priceData
                });

        if (currentLogLevel === 'verbose') {
            console.log(`✅ ${symbol}: ${priceData.lastPrice} actualizado`);
        }

        // Actualizar perfil también en actualización manual
            try {
                await ensureAssetProfile(db, symbol, schema, currentLogLevel);
            } catch (e) {
                console.error(`⚠️ Error actualizando perfil ${symbol} (manual):`, e.message);
            }

        return priceData;
    } catch (error) {
        if (currentLogLevel === 'verbose') {
            console.error(`❌ Error updating ${symbol}:`, error.message);
        }
        return null;
    }
}

/**
 * Obtiene precio actual de un símbolo
 * @param {string} symbol - Símbolo a consultar
 * @returns {Promise<Object|null>} Datos de precio o null
 */
export async function getCurrentPrice(db, symbol) {
    const currentLogLevel = await getLogLevel(db, eq, schema);
    try {
        return await db.query.globalCurrentPrices.findFirst({
            where: eq(schema.globalCurrentPrices.symbol, symbol)
        });
    } catch (error) {
        if (currentLogLevel === 'verbose') {
            console.error(`Error getting current price for ${symbol}:`, error.message);
        }
        return null;
    }
}

/**
 * Obtiene precios actuales de múltiples símbolos (batch)
 * @param {Array<string>} symbols - Array de símbolos
 * @returns {Promise<Array>} Array de precios
 */
export async function getCurrentBatch(db, symbols) {
    const currentLogLevel = await getLogLevel(db, eq, schema);
    try {
        return await db.select()
            .from(schema.globalCurrentPrices)
            .where(inArray(schema.globalCurrentPrices.symbol, symbols));
    } catch (error) {
        if (currentLogLevel === 'verbose') {
            console.error('Error getting batch prices:', error.message);
        }
        return [];
    }
}

export default {
    updateAllActivePrices,
    updateSinglePrice,
    getCurrentPrice,
    getCurrentBatch
};

/**
 * Asegura que exista un perfil de activo actualizado
 * @param {string} symbol - Símbolo del activo
 * @param {string} logLevel - Nivel de log actual
 */
export async function ensureAssetProfile(db, symbol, schema, logLevel = 'info') {
    try {
        console.log('DEBUG: eq in ensureAssetProfile:', eq);
        const profile = await db.query.assetProfiles.findFirst({ 
            where: eq(schema.assetProfiles.symbol, symbol) 
        });
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        if (!profile || new Date(profile.updatedAt) < thirtyDaysAgo) {
            const profileData = await fetchAssetProfile(symbol);
            if (profileData) {
                await db.insert(schema.assetProfiles)
                    .values(profileData)
                    .onConflictDoUpdate({
                        target: schema.assetProfiles.symbol,
                        set: profileData
                    });
            }
        }
    } catch (profileError) {
        // Manejar silenciosamente errores de actualización de perfil
    }
}
