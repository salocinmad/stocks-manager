import { EODHDService } from '../services/eodhdService';

/**
 * Job para sincronizar la librería global de tickers el día 1 de cada mes
 * Se ejecuta mediante un intervalo que comprueba la fecha cada hora
 */
let lastSyncMonth = -1;

export function scheduleGlobalTickerJob(): void {
    setInterval(async () => {
        const now = new Date();
        const madTimeString = now.toLocaleString("en-US", { timeZone: "Europe/Madrid" });
        const madTime = new Date(madTimeString);

        const day = madTime.getDate();
        const month = madTime.getMonth();
        const hours = madTime.getHours();

        // Ejecutar el día 1 del mes, a las 02:00 AM, una vez al mes
        if (day === 1 && hours === 2 && month !== lastSyncMonth) {
            lastSyncMonth = month;
            console.log('[Job] Iniciando sincronización mensual de Librería Global de Tickers...');
            try {
                await EODHDService.syncAllExchanges((msg) => {
                    console.log(`[Job-Progress] ${msg}`);
                });
                console.log('[Job] Sincronización mensual completada con éxito.');
            } catch (error) {
                console.error('[Job] Error en sincronización mensual de tickers:', error);
            }
        }
    }, 60 * 60 * 1000); // Comprobar cada hora
}
