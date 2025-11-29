/**
 * DEPRECATED: Este archivo se mantiene por compatibilidad
 * La nueva lógica está en services/scheduler/priceScheduler.js
 * 
 * Este archivo ahora solo delega al nuevo servicio modular
 */

import { startPriceScheduler, stopPriceScheduler, runManualUpdate } from './scheduler/priceScheduler.js';

// Delegación completa al nuevo servicio modular
export async function start() {
  await startPriceScheduler();
  return { ok: true, minutes: 15 };  // Compatibilidad con código antiguo
}

export function stop() {
  stopPriceScheduler();
}

// runOnce para compatibilidad con daily close
export async function runOnce() {
  console.log('🔄 Ejecutando actualización única (runOnce)...');
  return await runManualUpdate();
}

export default {
  start,
  stop,
  runOnce
};

