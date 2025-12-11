/**
 * DEPRECATED: Este archivo se mantiene por compatibilidad
 * La nueva lógica está en services/scheduler/priceScheduler.js
 * 
 * Este archivo ahora solo delega al nuevo servicio modular
 */

import { startPriceScheduler, stopPriceScheduler, runManualUpdate } from './scheduler/priceScheduler.js';
import { getLogLevel } from './configService.js';
import { eq } from 'drizzle-orm';

// Delegación completa al nuevo servicio modular
export async function start(db) {
  try {
    await startPriceScheduler(db);
  } catch (error) {
    console.error('Error in startPriceScheduler:', error);
    return { ok: false, reason: error.message };
  }
  return { ok: true, minutes: 15 };  // Compatibilidad con código antiguo
}

export function stop() {
  stopPriceScheduler();
}

// runOnce para compatibilidad con daily close
export async function runOnce(db) {
    const currentLogLevel = await getLogLevel(db, eq);
    if (currentLogLevel === 'verbose') {
        console.log('🔄 Ejecutando actualización única (runOnce)...');
    }
    return await runManualUpdate(db);
}

export default {
  start,
  stop,
  runOnce
};

