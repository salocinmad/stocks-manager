import sql from '../db';
import { SettingsService } from './settingsService';

export class EODHDService {
    private static async getApiKey() {
        const key = await SettingsService.get('EODHD_API_KEY');
        if (!key) {
            // Tentativa de buscar en process.env si no está en DB
            return process.env.EODHD_API_KEY || null;
        }
        return key;
    }

    /**
     * Descarga y guarda todos los tickers de una bolsa específica
     */
    static async syncExchange(exchangeCode: string): Promise<{ count: number, inserted: number, updated: number, skipped: number, error?: string }> {
        const apiKey = await this.getApiKey();
        if (!apiKey) return { count: 0, inserted: 0, updated: 0, skipped: 0, error: 'EODHD_API_KEY no configurada' };

        console.log(`\n========================================`);
        console.log(`[EODHD] 🌍 Mercado: ${exchangeCode}`);
        console.log(`========================================`);

        try {
            const url = `https://eodhd.com/api/exchange-symbol-list/${exchangeCode}?api_token=${apiKey}&fmt=json`;
            const response = await fetch(url);

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`API Error (${response.status}): ${text.substring(0, 100)}`);
            }

            const data = await response.json();
            if (!Array.isArray(data)) {
                throw new Error('Respuesta inválida de EODHD (se esperaba un array)');
            }

            console.log(`[EODHD] 📥 Recibidos: ${data.length} símbolos`);

            // Contadores detallados
            let inserted = 0;
            let updated = 0;
            let skipped = 0;

            for (const item of data) {
                // Solo nos interesan acciones comunes para la librería global
                if (item.Type !== 'Common Stock') {
                    skipped++;
                    continue;
                }

                // Verificar si ya existe
                const exists = await sql`SELECT symbol FROM global_tickers WHERE symbol = ${item.Code} AND exchange = ${exchangeCode}`;
                const isUpdate = exists.length > 0;

                await sql`
                    INSERT INTO global_tickers (symbol, name, isin, exchange, country, currency, type, last_sync_at)
                    VALUES (
                        ${item.Code}, 
                        ${item.Name || ''}, 
                        ${item.Isin || null}, 
                        ${exchangeCode}, 
                        ${item.Country || ''}, 
                        ${item.Currency || ''}, 
                        ${item.Type || ''}, 
                        NOW()
                    )
                    ON CONFLICT (symbol, exchange) 
                    DO UPDATE SET 
                        name = EXCLUDED.name,
                        isin = EXCLUDED.isin,
                        country = EXCLUDED.country,
                        currency = EXCLUDED.currency,
                        type = EXCLUDED.type,
                        last_sync_at = NOW()
                `;

                if (isUpdate) {
                    updated++;
                } else {
                    inserted++;
                }
            }

            const total = inserted + updated;
            console.log(`\n[EODHD] ✅ Resumen de ${exchangeCode}:`);
            console.log(`  ➕ Nuevas:       ${inserted}`);
            console.log(`  🔄 Actualizadas: ${updated}`);
            console.log(`  ⏭️  Saltadas:     ${skipped} (no son "Common Stock")`);
            console.log(`  📊 Total guardadas: ${total}\n`);

            return { count: total, inserted, updated, skipped };

        } catch (error: any) {
            console.error(`[EODHD] ❌ Error sincronizando ${exchangeCode}:`, error.message);
            return { count: 0, inserted: 0, updated: 0, skipped: 0, error: error.message };
        }
    }

    /**
     * Sincronización completa de las bolsas principales configuradas
     */
    static async syncAllExchanges(onProgress?: (msg: string) => void): Promise<void> {
        // Obtener bolsas de la configuración, o usar default (Sin USA)
        const configExchanges = await SettingsService.get('GLOBAL_TICKER_EXCHANGES');
        const EXCHANGES = configExchanges
            ? configExchanges.split(',').map(s => s.trim()).filter(Boolean)
            : ['MC', 'PA', 'LSE', 'F', 'XETRA', 'AS', 'MI', 'SW', 'TO', 'HK', 'NSE'];

        for (let i = 0; i < EXCHANGES.length; i++) {
            const exchange = EXCHANGES[i];

            // Seguridad: nunca sincronizar USA en la librería global para evitar solapamientos con Finnhub
            if (['US', 'NYSE', 'NASDAQ', 'BATS', 'AMEX', 'ARCA'].includes(exchange.toUpperCase())) {
                continue;
            }

            const msg = `Sincronizando ${exchange} (${i + 1}/${EXCHANGES.length})...`;
            console.log(msg);
            if (onProgress) onProgress(msg);

            await this.syncExchange(exchange);

            // Respetar el límite de créditos: 1 minuto entre llamadas
            if (i < EXCHANGES.length - 1) {
                const waitMsg = `Esperando 1 minuto para la siguiente bolsa (${EXCHANGES[i + 1]}) para ahorrar créditos...`;
                console.log(waitMsg);
                if (onProgress) onProgress(waitMsg);
                await new Promise(resolve => setTimeout(resolve, 60000));
            }
        }


        if (onProgress) onProgress('Sincronización mundial completada con éxito.');
    }

    /**
     * Get list of all available exchanges from EODHD
     * Uses 30-day DB cache to conserve API credits
     */
    static async getAvailableExchanges(forceRefresh: boolean = false): Promise<any[]> {
        const CACHE_KEY = 'eodhd_exchanges_list';
        const CACHE_DAYS = 30;

        try {
            // Check cache first (unless force refresh)
            if (!forceRefresh) {
                const cached = await sql`
                    SELECT data, expires_at 
                    FROM market_cache 
                    WHERE key = ${CACHE_KEY} AND expires_at > NOW()
                `;
                if (cached.length > 0) {
                    console.log('[EODHD] Usando lista de bolsas desde caché');
                    // Defensive parse in case data is stored as string
                    const data = cached[0].data;
                    return Array.isArray(data) ? data : (typeof data === 'string' ? JSON.parse(data) : []);
                }
            }

            // Fetch from API
            const apiKey = await this.getApiKey();
            if (!apiKey) {
                console.error('[EODHD] API Key no configurada');
                return [];
            }

            console.log('[EODHD] Descargando lista de bolsas mundiales...');
            const url = `https://eodhd.com/api/exchanges-list/?api_token=${apiKey}&fmt=json`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();

            if (!Array.isArray(data)) {
                throw new Error('Respuesta inválida (se esperaba array)');
            }

            // Parse and clean data
            const exchanges = data.map((ex: any) => ({
                code: ex.Code,
                name: ex.Name,
                country: ex.Country,
                currency: ex.Currency,
                operatingMIC: ex.OperatingMIC || null
            }));

            // Save to cache with 30-day expiry
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + CACHE_DAYS);

            await sql`
                INSERT INTO market_cache (key, data, expires_at, updated_at)
                VALUES (${CACHE_KEY}, ${sql.json(exchanges)}, ${expiresAt}, NOW())
                ON CONFLICT (key) 
                DO UPDATE SET data = ${sql.json(exchanges)}, expires_at = ${expiresAt}, updated_at = NOW()
            `;

            console.log(`[EODHD] Guardadas ${exchanges.length} bolsas en caché (válido ${CACHE_DAYS} días)`);
            return exchanges;

        } catch (error: any) {
            console.error('[EODHD] Error obteniendo lista de bolsas:', error.message);

            // Fallback: try to return expired cache if exists
            const expired = await sql`
                SELECT data FROM market_cache WHERE key = ${CACHE_KEY}
            `;
            if (expired.length > 0) {
                console.log('[EODHD] Usando caché expirada como fallback');
                const data = expired[0].data;
                return Array.isArray(data) ? data : (typeof data === 'string' ? JSON.parse(data) : []);
            }

            return [];
        }
    }
}
