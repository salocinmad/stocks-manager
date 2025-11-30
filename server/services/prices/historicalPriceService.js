/**
 * Servicio de gestión de precios históricos
 * CRUD para GlobalStockPrices
 */

import { Op } from 'sequelize';
import GlobalStockPrice from '../../models/GlobalStockPrice.js';
import { fetchHistorical } from '../datasources/yahooService.js';
import { HISTORICAL_CONFIG } from '../../utils/constants.js';
import { formatDateOnly } from '../../utils/dateHelpers.js';

/**
 * Guarda histórico de Yahoo Finance en DB
 * @param {string} symbol - Símbolo bursátil
 * @param {number} days - Días hacia atrás  
 * @returns {Promise<Array>} Registros guardados
 */
export async function fetchAndSaveHistorical(symbol, days = HISTORICAL_CONFIG.DEFAULT_DAYS) {
    const historical = await fetchHistorical(symbol, days);

    if (historical.length === 0) {
        return [];
    }

    const saved = [];

    for (const day of historical) {
        // Calcular change usando previousClose de DB
        const previousDay = await GlobalStockPrice.findOne({
            where: {
                symbol,
                date: { [Op.lt]: day.date }
            },
            order: [['date', 'DESC']],
            limit: 1
        });

        const change = previousDay ? (day.close - previousDay.close) : null;
        const changePercent = previousDay && previousDay.close > 0
            ? ((change / previousDay.close) * 100)
            : null;

        // Upsert (findOrCreate + update)
        const [record, created] = await GlobalStockPrice.findOrCreate({
            where: { symbol, date: day.date },
            defaults: {
                open: day.open,
                high: day.high,
                low: day.low,
                close: day.close,
                volume: day.volume,
                change,
                changePercent,
                adjClose: day.adjClose,
                source: 'yahoo'
            }
        });

        if (created) {
            saved.push(record);
        } else {
            // Actualizar si existe (Yahoo puede corregir datos)
            await record.update({
                open: day.open,
                high: day.high,
                low: day.low,
                close: day.close,
                volume: day.volume,
                adjClose: day.adjClose
            });
        }
    }

    return saved;
}

/**
 * Detecta y rellena gaps en histórico
 * @param {string} symbol - Símbolo
 * @param {number} maxDaysBack - Días máximos a revisar
 */
export async function fillHistoricalGaps(symbol, maxDaysBack = HISTORICAL_CONFIG.DEFAULT_DAYS) {
    // Obtener primer registro
    const firstRecord = await GlobalStockPrice.findOne({
        where: { symbol },
        order: [['date', 'ASC']],
        limit: 1
    });

    if (!firstRecord) {
        // No hay histórico, hacer backfill completo
        console.log(`📊 ${symbol}: Sin histórico, backfill completo`);
        await fetchAndSaveHistorical(symbol, maxDaysBack);
        return;
    }

    // Ver ificar si hay gap significativo
    const today = new Date();
    const daysSinceFirst = Math.floor((today - new Date(firstRecord.date)) / (1000 * 60 * 60 * 24));
    const recordCount = await GlobalStockPrice.count({ where: { symbol } });
    const expectedDays = daysSinceFirst * HISTORICAL_CONFIG.GAP_THRESHOLD;

    if (recordCount >= expectedDays) {
        console.log(`✅ ${symbol}: Histórico completo (${recordCount} días)`);
        return;
    }

    // Hay gap, rellenar
    console.log(`🔧 ${symbol}: Gap detectado, rellenando...`);
    await fetchAndSaveHistorical(symbol, daysSinceFirst);
}

/**
 * Obtiene histórico de precios de un símbolo
 * @param {string} symbol - Símbolo
 * @param {number} days - Días hacia atrás
 * @returns {Promise<Array>} Array de precios históricos
 */
export async function getHistoricalPrices(symbol, days = 30) {
    const endDate = formatDateOnly(new Date());
    const startDate = formatDateOnly(new Date(Date.now() - days * 24 * 60 * 60 * 1000));

    return await GlobalStockPrice.findAll({
        where: {
            symbol,
            date: { [Op.between]: [startDate, endDate] }
        },
        order: [['date', 'ASC']]
    });
}

/**
 * Obtiene precio de cierre para una fecha específica
 * @param {string} symbol - Símbolo
 * @param {string} date - Fecha en formato 'YYYY-MM-DD'
 * @returns {Promise<Object|null>} Registro de precio o null
 */
export async function getPriceForDate(symbol, date) {
    return await GlobalStockPrice.findOne({
        where: { symbol, date }
    });
}

export default {
    fetchAndSaveHistorical,
    fillHistoricalGaps,
    getHistoricalPrices,
    getPriceForDate
};
