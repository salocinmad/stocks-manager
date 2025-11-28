/**
 * Servicio de gestión de precios actuales
 * CRUD para GlobalCurrentPrices
 */

import { Op } from 'sequelize';
import GlobalCurrentPrice from '../../models/GlobalCurrentPrice.js';
import Operation from '../../models/Operation.js';
import { fetchCombinedPrice } from '../datasources/priceCombinaService.js';
import { getUniqueSymbols } from '../../utils/symbolHelpers.js';

/**
 * Actualiza precios de TODAS las acciones en uso
 * Usado por: scheduler automático y botón manual
 * @returns {Promise<Object>} Resumen de actualización
 */
export async function updateAllActivePrices() {
    console.log('🔄 Actualizando precios de acciones EN USO...');

    // 1. Obtener símbolos únicos EN USO
    const operations = await Operation.findAll({
        attributes: ['symbol'],
        where: {
            symbol: { [Op.not]: null, [Op.not]: '' }
        }
    });

    const symbols = getUniqueSymbols(operations);
    console.log(`📊 ${symbols.length} acciones activas`);

    let updated = 0;
    let errors = 0;

    // 2. Actualizar cada símbolo
    for (const symbol of symbols) {
        try {
            const priceData = await fetchCombinedPrice(symbol);

            if (!priceData) {
                console.log(`⚠️  ${symbol}: Sin datos`);
                continue;
            }

            // Upsert en GlobalCurrentPrices
            await GlobalCurrentPrice.upsert({
                symbol,
                ...priceData
            });

            console.log(`✅ ${symbol}: ${priceData.lastPrice} (${priceData.source})`);
            updated++;

        } catch (error) {
            console.error(`❌ ${symbol}:`, error.message);
            errors++;
        }
    }

    console.log(`\n📊 Resumen: ✅ ${updated} actualizadas, ❌ ${errors} errores`);
    return { updated, errors, total: symbols.length };
}

/**
 * Actualiza precio de un único símbolo
 * @param {string} symbol - Símbolo a actualizar
 * @returns {Promise<Object|null>} Datos actualizados o null
 */
export async function updateSinglePrice(symbol) {
    try {
        const priceData = await fetchCombinedPrice(symbol);

        if (!priceData) {
            return null;
        }

        await GlobalCurrentPrice.upsert({
            symbol,
            ...priceData
        });

        console.log(`✅ ${symbol}: ${priceData.lastPrice} actualizado`);
        return priceData;
    } catch (error) {
        console.error(`❌ Error updating ${symbol}:`, error.message);
        return null;
    }
}

/**
 * Obtiene precio actual de un símbolo
 * @param {string} symbol - Símbolo a consultar
 * @returns {Promise<Object|null>} Datos de precio o null
 */
export async function getCurrentPrice(symbol) {
    try {
        return await GlobalCurrentPrice.findOne({ where: { symbol } });
    } catch (error) {
        console.error(`Error getting current price for ${symbol}:`, error.message);
        return null;
    }
}

/**
 * Obtiene precios actuales de múltiples símbolos (batch)
 * @param {Array<string>} symbols - Array de símbolos
 * @returns {Promise<Array>} Array de precios
 */
export async function getCurrentBatch(symbols) {
    try {
        return await GlobalCurrentPrice.findAll({
            where: { symbol: { [Op.in]: symbols } }
        });
    } catch (error) {
        console.error('Error getting batch prices:', error.message);
        return [];
    }
}

export default {
    updateAllActivePrices,
    updateSinglePrice,
    getCurrentPrice,
    getCurrentBatch
};
