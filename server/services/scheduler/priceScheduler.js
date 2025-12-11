/**
 * Scheduler modular de actualización de precios
 * Reemplaza lógica antigua en scheduler.js
 */

import { updateAllActivePrices } from '../prices/currentPriceService.js';

import * as schema from '../../drizzle/schema.js';
import { eq } from 'drizzle-orm';
import { SCHEDULER_INTERVALS } from '../../utils/constants.js';
import { getLogLevel } from '../configService.js';

let priceUpdateTimer = null;

/**
 * Inicia el scheduler de actualización de precios
 * @returns {Promise<void>}
 */
export async function startPriceScheduler(db) {
    const currentLogLevel = await getLogLevel(db, eq);
    // Obtener intervalo de configuración
    const minutes = SCHEDULER_INTERVALS.PRICE_UPDATE;

    // Si ya está corriendo, detenerlo primero
    if (priceUpdateTimer) {
        clearInterval(priceUpdateTimer);
    }

    if (currentLogLevel === 'verbose') {
        console.log(`🚀 Iniciando scheduler de precios (cada ${minutes} minutos)...`);
    }

    // Ejecutar inmediatamente
    console.log('DEBUG: eq in priceScheduler.js before updateAllActivePrices:', eq);
    await updateAllActivePrices(db, schema);

    // Luego ejecutar periódicamente
    priceUpdateTimer = setInterval(async () => {
        if (currentLogLevel === 'verbose') {
            console.log('\n⏰ Scheduler: Ejecutando actualización periódica...');
        }
        await updateAllActivePrices(db, schema);
    }, minutes * 60 * 1000);

    if (currentLogLevel === 'verbose') {
        console.log(`✅ Scheduler de precios iniciado`);
    }
}

/**
 * Detiene el scheduler
 */
export function stopPriceScheduler() {
    if (priceUpdateTimer) {
        clearInterval(priceUpdateTimer);
        priceUpdateTimer = null;
        // No necesitamos getLogLevel aquí, ya que es una función de detención y siempre debe registrarse.
        console.log('⏸️  Scheduler de precios detenido');
    }
}

/**
 * Ejecuta actualización manual (botón "Actualizar Precios")
 * @returns {Promise<Object>} Resultado de la actualización
 */
export async function runManualUpdate(db) {
    const currentLogLevel = await getLogLevel(db, eq);
    if (currentLogLevel === 'verbose') {
        console.log('🔄 Actualización manual de precios solicitada');
    }
    return await updateAllActivePrices(db, schema);
}

export default {
    startPriceScheduler,
    stopPriceScheduler,
    runManualUpdate
};
