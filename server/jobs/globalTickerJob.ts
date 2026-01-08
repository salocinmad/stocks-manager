import { EODHDService } from '../services/eodhdService';
import { log } from '../utils/logger';

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
            log.info('[GlobalTickerJob]', 'Starting monthly global library sync...');
            try {
                await EODHDService.syncAllExchanges((msg) => {
                    log.verbose('[GlobalTickerJob]', msg);
                });
                log.summary('[GlobalTickerJob]', '✅ Monthly sync completed successfully.');
            } catch (error) {
                log.error('[GlobalTickerJob]', 'Monthly sync error:', error);
            }
        }
    }, 60 * 60 * 1000); // Check every hour
}
