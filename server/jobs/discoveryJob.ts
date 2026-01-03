import { DiscoveryService } from '../services/discoveryService';
import { MarketDataService } from '../services/marketData';
import { SettingsService } from '../services/settingsService';
import yahooFinance from 'yahoo-finance2';

/**
 * Smart Discovery Crawler 3.0 (Split-World Pipeline)
 * 
 * Architecture:
 * - Independent Pipelines for US and Global markets to maximize data relevancy.
 * - Smart Skipping: Checks DB before fetching expensive fundamental data (V10).
 * - Targeted Markets: US Pipeline (US Only), Global Pipeline (ES, DE, FR, UK, MX, JP, CN, HK).
 */

const SECTOR_SCREENERS = [
    'ms_technology', 'ms_financial_services', 'ms_healthcare', 'ms_consumer_cyclical',
    'ms_industrials', 'ms_energy', 'ms_consumer_defensive', 'ms_real_estate',
    'ms_utilities', 'ms_basic_materials', 'ms_communication_services'
];

// Target Markets for Global Pipeline (Non-US)
const GLOBAL_MARKETS = ['.MC', '.DE', '.PA', '.L', '.MX', '.T', '.SS', '.SZ', '.HK'];

export const DiscoveryJob = {

    lastRunTime: 0,

    async runDiscoveryCycle() {
        const now = Date.now();
        // console.log('[DiscoveryCrawler] Checking schedule...');

        try {
            // 1. Check Global Switch (HARD STOP)
            const enabled = await SettingsService.get('CRAWLER_ENABLED');
            if (enabled !== 'true') {
                console.log('[DiscoveryCrawler] Interruptor Maestro APAGADO. Operación omitida.');
                return;
            }

            // 2. Check Frequency Window
            const cyclesPerHour = parseInt(await SettingsService.get('CRAWLER_CYCLES_PER_HOUR') || '6');
            const cooldownMinutes = 60 / Math.max(1, Math.min(cyclesPerHour, 60));
            const minutesSinceLast = (now - this.lastRunTime) / 60000;

            if (minutesSinceLast < cooldownMinutes) return;

            // Start Cycle
            this.lastRunTime = now;
            console.log(`[DiscoveryCrawler] Iniciando Ciclo (Config: ${cyclesPerHour}/hr)...`);

            // Load Volumes
            // volFinnhub -> US Pipeline Volume
            // volV8 -> Global Pipeline V8 (Fast) Volume
            // volV10 -> Global Pipeline V10 (Deep) Volume
            const volFinnhub = parseInt(await SettingsService.get('CRAWLER_VOL_FINNHUB') || '20'); // US Target
            const volV8 = parseInt(await SettingsService.get('CRAWLER_VOL_YAHOO_V8') || '10'); // Global Fast Target
            const volV10 = parseInt(await SettingsService.get('CRAWLER_VOL_YAHOO_V10') || '20'); // Global Deep Target

            // Note: Market Open checks removed/deprioritized for this architecture as requested, 
            // but we can re-enable specialized "Day Gainer" logic if needed. 
            // For now, we assume standard Sector Rotation is desired always for filling the DB.

            // 2. Refresh Safe Screeners List (Yahoo Finance Strict Validation)
            // We cannot use 'ms_energy' etc directly. We must use valid screeners and group manually.
            const VALID_SCREENERS = [
                'day_gainers',
                'day_losers',
                'most_actives',
                'undervalued_growth_stocks',
                'undervalued_large_caps',
                'growth_technology_stocks',
                'aggressive_small_caps',
                'top_mutual_funds'
            ];

            const screenerId = VALID_SCREENERS[Math.floor(Math.random() * VALID_SCREENERS.length)];
            console.log(`[DiscoveryCrawler] Obteniendo candidatos via '${screenerId}'...`);

            // Fetch a larger pool to ensure we get diversity across sectors
            let pool = await MarketDataService.getDiscoveryCandidates(screenerId, 100);

            // Enrich "Unknown" sectors (critical fix for Yahoo Screener missing data)
            pool = await MarketDataService.enrichSectors(pool);

            // Group by Sector to maintain the "Specific Targeted Discovery" illusion/utility
            const bySector: Record<string, any[]> = {};
            for (const item of pool) {
                const s = item.s || 'Unknown';
                if (!bySector[s]) bySector[s] = [];
                bySector[s].push(item);
            }

            console.log(`[DiscoveryDebug] ${pool.length} candidatos agrupados en ${Object.keys(bySector).length} sectores.`);

            // Process each sector group
            for (const sector of Object.keys(bySector)) {
                const sectorItems = bySector[sector];
                const cleanSectorName = sector.toLowerCase().replace(/ /g, '_');

                // Debug Log per Sector
                // console.log(`[DiscoveryDebug] Procesando Sector: ${sector} (${sectorItems.length} items)`);

                // === PIPELINE 1: US DEEP (From this sector group) ===
                // Announce Pipeline Start for this sector
                try {
                    const usItems = sectorItems.filter((i: any) => !i.t.includes('.'));
                    // Debug Log always
                    console.log(`[DiscoveryDebug] Evaluando Pipeline USA (Finnhub) para Sector: ${sector} (${usItems.length} candidatos)...`);

                    if (usItems.length > 0) {
                        const freshSet = await MarketDataService.checkFreshness(usItems.map((c: any) => c.t));

                        // Select up to volFinnhub items that aren't fresh
                        const selected: any[] = [];
                        for (const cand of usItems) {
                            if (selected.length >= volFinnhub) break;
                            if (freshSet.has(cand.t)) continue;
                            try {
                                const f = await MarketDataService.getFundamentals(cand.t);
                                if (f) selected.push({ ...cand, fund: { ...cand.fund, ...f } });
                            } catch (e) { }
                        }

                        if (selected.length > 0) {
                            await DiscoveryService.saveDiscoveryData(`us_${cleanSectorName}`, selected);
                            const time = new Date().toISOString();
                            const tickers = selected.map((s: any) => s.t).join(', ');
                            console.log(`[${time}] CRAWLER [Finnhub] (Pipeline USA) Sector: ${sector} | Total: ${usItems.length} | Frescos: ${freshSet.size} | Añadidos: ${selected.length} | Items: [${tickers}]`);
                        }
                    } else {
                        // Optional: Log empty state
                        // console.log(`[DiscoveryDebug] No US candidates in sector ${sector}.`);
                    }
                } catch (e: any) {
                    const msg = `[Crawler US] Error procesando sector ${sector}: ${e.message}\n`;
                    console.error(msg);
                    await Bun.write('crawler_debug.log', msg);
                }

                // === PIPELINE 2: GLOBAL SHARED (from this sector group) ===
                try {
                    const globalItems = sectorItems.filter((item: any) => {
                        return GLOBAL_MARKETS.some(suffix => item.t.endsWith(suffix));
                    });

                    // Debug Log always
                    console.log(`[DiscoveryDebug] Evaluando Pipeline Global (Yahoo) para Sector: ${sector} (${globalItems.length} candidatos)...`);

                    if (globalItems.length > 0) {
                        // V8 Branch (Fast) - Save all or subset? Save subset.
                        const fastItems = globalItems.slice(0, volV8);
                        if (fastItems.length > 0) {
                            await DiscoveryService.saveDiscoveryData(`global_fast_${cleanSectorName}`, fastItems);
                            const time = new Date().toISOString();
                            const tickers = fastItems.map((s: any) => s.t).join(', ');
                            console.log(`[${time}] CRAWLER [Yahoo V8] (Global Rapido) Sector: ${sector} | Total: ${globalItems.length} | Añadidos: ${fastItems.length} | Items: [${tickers}]`);
                        }

                        // V10 Branch (Deep)
                        const freshSet = await MarketDataService.checkFreshness(globalItems.map((c: any) => c.t));
                        const deepItems: any[] = [];
                        for (const cand of globalItems) {
                            if (deepItems.length >= volV10) break;
                            if (freshSet.has(cand.t)) continue;
                            try {
                                const f = await MarketDataService.getFundamentals(cand.t);
                                if (f) deepItems.push({ ...cand, fund: { ...cand.fund, ...f } });
                            } catch (e) { }
                        }

                        if (deepItems.length > 0) {
                            await DiscoveryService.saveDiscoveryData(`global_deep_${cleanSectorName}`, deepItems);
                            const time = new Date().toISOString();
                            const tickers = deepItems.map((s: any) => s.t).join(', ');
                            console.log(`[${time}] CRAWLER [Yahoo V10] (Global Profundo) Sector: ${sector} | Total: ${globalItems.length} | Frescos: ${freshSet.size} | Añadidos: ${deepItems.length} | Items: [${tickers}]`);
                        }
                    } else {
                        // Optional: Log empty state
                        // console.log(`[DiscoveryDebug] No Global candidates in sector ${sector}.`);
                    }

                } catch (e: any) {
                    const msg = `[Crawler Global] Error procesando sector ${sector}: ${e.message}\n`;
                    console.error(msg);
                    await Bun.write('crawler_debug.log', msg);
                }
            }

            console.log(`[DiscoveryCrawler] Ciclo completado a las ${new Date().toISOString()}`);

        } catch (error) {
            console.error('[DiscoveryCrawler] Cycle failed:', error);
        }
    },

    // Legacy / Manual Triggers
    async scanTrending() { await this.runDiscoveryCycle(); },
    async scanHybridPair() { await this.runDiscoveryCycle(); }
}
