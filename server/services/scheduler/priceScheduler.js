/**
 * Scheduler modular de actualización de precios
 * Reemplaza lógica antigua en scheduler.js
 */

import { updateAllActivePrices } from '../prices/currentPriceService.js';
import Config from '../../models/Config.js';
import { SCHEDULER_INTERVALS } from '../../utils/constants.js';

let priceUpdateTimer = null;

/**
 * Inicia el scheduler de actualización de precios
 * @returns {Promise<void>}
 */
export async function startPriceScheduler() {
    // Obtener intervalo de configuración
    const config = await Config.findOne({ where: { key: 'scheduler_interval_minutes' } });
    const minutes = config?.value ? parseInt(config.value) : SCHEDULER_INTERVALS.PRICE_UPDATE;

    // Si ya está corriendo, detenerlo primero
    if (priceUpdateTimer) {
        clearInterval(priceUpdateTimer);
    }

    // console.log(`🚀 Iniciando scheduler de precios (cada ${minutes} minutos)...`);

    // Ejecutar inmediatamente
    await updateAllActivePrices();

    // Luego ejecutar periódicamente
    priceUpdateTimer = setInterval(async () => {
        // console.log('\n⏰ Scheduler: Ejecutando actualización periódica...');
        await updateAllActivePrices();
    }, minutes * 60 * 1000);

    // console.log(`✅ Scheduler de precios iniciado`);
}

/**
 * Detiene el scheduler
 */
export function stopPriceScheduler() {
    if (priceUpdateTimer) {
        clearInterval(priceUpdateTimer);
        priceUpdateTimer = null;
        // console.log('⏸️  Scheduler de precios detenido');
    }
}

/**
 * Ejecuta actualización manual (botón "Actualizar Precios")
 * @returns {Promise<Object>} Resultado de la actualización
 */
export async function runManualUpdate() {
    // console.log('🔄 Actualización manual de precios solicitada');
    return await updateAllActivePrices();
}

export default {
    startPriceScheduler,
    stopPriceScheduler,
    runManualUpdate
};
