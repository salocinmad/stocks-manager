/**
 * Servicio de gestión de precios actuales
 * CRUD para GlobalCurrentPrices
 */

import { Op } from 'sequelize';
import GlobalCurrentPrice from '../../models/GlobalCurrentPrice.js';
import AssetProfile from '../../models/AssetProfile.js';
import Operation from '../../models/Operation.js';
import { fetchCombinedPrice } from '../datasources/priceCombinaService.js';
import { fetchAssetProfile } from '../datasources/yahooService.js';
import { getUniqueSymbols } from '../../utils/symbolHelpers.js';
import { getLogLevel } from '../configService.js';

/**
 * Actualiza precios de TODAS las acciones en uso
 * Usado por: scheduler automático y botón manual
 * @returns {Promise<Object>} Resumen de actualización
 */
export async function updateAllActivePrices() {
    const currentLogLevel = await getLogLevel();

    // 1. Obtener símbolos únicos EN USO
    const operations = await Operation.findAll({
        attributes: ['symbol'],
        where: {
            symbol: { [Op.not]: null, [Op.not]: '' }
        }
    });

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
            const [record, created] = await GlobalCurrentPrice.findOrCreate({
                where: { symbol },
                defaults: combined
            });

            if (!created) {
                await record.update(combined);
            }

            if (currentLogLevel === 'verbose') {
                console.log(`✅ ${symbol}: ${combined.lastPrice} (${combined.source})`);
            }
            updated++;

            // 3. Actualizar Perfil del Activo
            await ensureAssetProfile(symbol, currentLogLevel);

        } catch (error) {
            if (currentLogLevel === 'verbose') {
                console.error(`❌ ${symbol}:`, error.message);
            }
            failed++;
        }
    }

    // 4. Actualizar marcador de última ejecución para el frontend
    try {
        const Config = (await import('../../models/Config.js')).default;
        const nowIso = new Date().toISOString();
        await Config.upsert({ key: 'scheduler_last_run', value: nowIso });
        await Config.upsert({ key: 'last_prices_sync_at', value: nowIso });
    } catch (configError) {
        console.error('⚠️ Error actualizando configuración de sincronización:', configError.message);
    }

    return { updated, failed, total: symbols.length };
}

/**
 * Actualiza precio de un único símbolo (manual)
 * @param {string} symbol - Símbolo a actualizar
 * @returns {Promise<Object|null>} Datos actualizados o null
 */
export async function updateSinglePrice(symbol) {
    const currentLogLevel = await getLogLevel();
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

        await GlobalCurrentPrice.upsert({
            symbol,
            ...priceData
        });

        if (currentLogLevel === 'verbose') {
            console.log(`✅ ${symbol}: ${priceData.lastPrice} actualizado`);
        }

        // Actualizar perfil también en actualización manual
        try {
            const profile = await AssetProfile.findByPk(symbol);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            if (!profile || profile.updatedAt < thirtyDaysAgo) {
                const profileData = await fetchAssetProfile(symbol);
                if (profileData) {
                    await AssetProfile.upsert(profileData);
                }
            }
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
export async function getCurrentPrice(symbol) {
    const currentLogLevel = await getLogLevel();
    try {
        return await GlobalCurrentPrice.findOne({ where: { symbol } });
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
export async function getCurrentBatch(symbols) {
    const currentLogLevel = await getLogLevel();
    try {
        return await GlobalCurrentPrice.findAll({
            where: { symbol: { [Op.in]: symbols } }
        });
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
export async function ensureAssetProfile(symbol, logLevel = 'info') {
    try {
        const profile = await AssetProfile.findByPk(symbol);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        if (!profile || profile.updatedAt < thirtyDaysAgo) {
            const profileData = await fetchAssetProfile(symbol);
            if (profileData) {
                await AssetProfile.upsert(profileData);
            }
        }
    } catch (profileError) {
        // Manejar silenciosamente errores de actualización de perfil
    }
}
