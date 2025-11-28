/**
 * Servicio de gestión de precios actuales
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
