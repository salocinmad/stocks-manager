import { DiscoveryService } from '../services/discoveryService';
import { MarketDataService } from '../services/marketData';
import { SettingsService } from '../services/settingsService';
import { getRegionFromExchange } from '../utils/exchangeMapping';
import { log } from '../utils/logger';

/**
 * Smart Discovery Crawler 4.0 (Market-Aware Dual Pipeline)
 * 
 * Strategy:
 * - Executes BOTH US (Finnhub) and Global (Yahoo) pipelines in every cycle.
 * - Strategy selection based on Market Status (Open vs Closed).
 * - 7-Day Freshness Filter to optimize API calls.
 * - GLOBAL_REGIONS is loaded dynamically from admin config.
 */

const US_OPEN_SCREENERS = ['day_gainers', 'most_actives'];
const US_CLOSED_SCREENERS = [
    'growth_technology_stocks',
    'undervalued_large_caps',
    'undervalued_growth_stocks',
    'aggressive_small_caps',
    'top_mutual_funds'
];

// Fallback regions if no config found
const DEFAULT_REGIONS = ['DE', 'ES', 'GB', 'FR', 'IT', 'HK', 'AU'];

const REGION_CURRENCY_MAP: Record<string, string> = {
    'DE': 'EUR', 'ES': 'EUR', 'FR': 'EUR', 'IT': 'EUR',
    'GB': 'GBP', 'HK': 'HKD', 'AU': 'AUD'
};

const REGION_INDEX_MAP: Record<string, string> = {
    'US': '^IXIC',
    'DE': '^GDAXI',
    'ES': '^IBEX',
    'FR': '^FCHI',
    'IT': 'FTSEMIB.MI',
    'GB': '^FTSE',
    'HK': '^HSI',
    'AU': '^AXJO'
};

/**
 * Get active regions from configured exchanges
 */
async function getActiveRegions(): Promise<string[]> {
    const configExchanges = await SettingsService.get('GLOBAL_TICKER_EXCHANGES');
    if (!configExchanges) return DEFAULT_REGIONS;

    const exchanges = configExchanges.split(',').map(s => s.trim()).filter(Boolean);
    const regions = exchanges
        .map(ex => getRegionFromExchange(ex))
        .filter((r): r is string => !!r);

    // Deduplicate and return
    return [...new Set(regions)].length > 0 ? [...new Set(regions)] : DEFAULT_REGIONS;
}

export const DiscoveryJob = {
    lastRunTime: 0,

    async runDiscoveryCycle() {
        const now = Date.now();
        let usaCount = 0;
        let globalCount = 0;
        let errors = 0;

        try {
            // 1. Maestro Switch
            const enabled = await SettingsService.get('CRAWLER_ENABLED');
            if (enabled !== 'true') return;

            // 2. Cooling window (Fine Tuning)
            const cyclesPerHour = parseInt(await SettingsService.get('CRAWLER_CYCLES_PER_HOUR') || '6');
            const cooldownMinutes = 60 / Math.max(1, Math.min(cyclesPerHour, 60));
            const minutesSinceLast = (now - this.lastRunTime) / 60000;

            if (minutesSinceLast < cooldownMinutes) return;

            this.lastRunTime = now;
            log.info('[DiscoveryJob]', `Iniciando Ciclo Market-Aware (${cyclesPerHour}/hr)...`);

            // 3. Load Tuning params
            const volFinnhub = parseInt(await SettingsService.get('CRAWLER_VOL_FINNHUB') || '20');
            const volV10 = parseInt(await SettingsService.get('CRAWLER_VOL_YAHOO_V10') || '20');

            // 4. Get active regions dynamically
            const activeRegions = await getActiveRegions();
            const targetRegion = activeRegions[Math.floor(Math.random() * activeRegions.length)];

            // 5. Determine Market Statuses
            const statusResults = await MarketDataService.getMarketStatus(['^IXIC', REGION_INDEX_MAP[targetRegion] || '^GDAXI']);

            const usStatus = statusResults.find(s => s.symbol === '^IXIC')?.state || 'CLOSED';
            const globalStatus = statusResults.find(s => s.symbol === REGION_INDEX_MAP[targetRegion])?.state || 'CLOSED';

            const isUsOpen = usStatus === 'REGULAR';
            const isGlobalOpen = globalStatus === 'REGULAR';

            log.verbose('[DiscoveryJob]', `Status -> USA: ${usStatus}, ${targetRegion}: ${globalStatus}`);

            // === PIPELINE 1: USA (Finnhub Engine) ===
            try {
                // Strategy: Open -> Momentum, Closed -> Structural
                const screener = isUsOpen
                    ? US_OPEN_SCREENERS[Math.floor(Math.random() * US_OPEN_SCREENERS.length)]
                    : US_CLOSED_SCREENERS[Math.floor(Math.random() * US_CLOSED_SCREENERS.length)];

                // Map screener to Finnhub categories (general, technology, business)
                let fhCategory = 'general';
                if (screener.includes('technology')) fhCategory = 'technology';
                if (screener.includes('growth') || screener.includes('undervalued')) fhCategory = 'business';

                log.info('[DiscoveryJob]', `USA Pipeline -> Motor: Finnhub, Estrategia: ${screener}`);

                const fhItems = await MarketDataService.getDiscoveryCandidatesFinnhub(fhCategory, 50);

                if (fhItems.length > 0) {
                    const freshSet = await MarketDataService.checkFreshness(fhItems.map(c => c.t));
                    const selected: any[] = [];
                    const detailsBatch: any[] = [];

                    // Optimization: Process in Batches of 5 for Concurrency
                    const BATCH_SIZE = 5;
                    const candidatesToProcess = fhItems.filter(item => !freshSet.has(item.t));

                    log.debug('[DiscoveryJob]', `USA: ${fhItems.length} candidatos, ${candidatesToProcess.length} a procesar`);

                    for (let i = 0; i < candidatesToProcess.length; i += BATCH_SIZE) {
                        if (selected.length >= volFinnhub) break;

                        const chunk = candidatesToProcess.slice(i, i + BATCH_SIZE);
                        const promises = chunk.map(async (item) => {
                            try {
                                const f = await MarketDataService.getFundamentals(item.t);
                                if (f) {
                                    return {
                                        enriched: { ...item, fund: { ...item.fund, ...f } },
                                        detail: { ticker: item.t, data: { ...f, price: item.p, symbol: item.t } }
                                    };
                                }
                            } catch (e: any) {
                                // Mark permanent failures
                                const msg = e?.message || '';
                                if (msg.includes('Quote not found') || msg.includes('internal-error')) {
                                    const parts = item.t.split('.');
                                    await MarketDataService.markCatalogFailed(parts[0], parts[1] || '', msg);
                                }
                            }
                            return null;
                        });

                        const results = await Promise.all(promises);

                        results.forEach(res => {
                            if (res && selected.length < volFinnhub) {
                                selected.push(res.enriched);
                                detailsBatch.push(res.detail);
                            }
                        });
                    }

                    // Bulk Save Details
                    if (detailsBatch.length > 0) {
                        await DiscoveryService.saveTickerDetailsBatch(detailsBatch);
                    }

                    if (selected.length > 0) {
                        await DiscoveryService.saveDiscoveryData(`us_${fhCategory}`, selected);
                        usaCount = selected.length;
                        log.verbose('[DiscoveryJob]', `USA -> ${selected.length} items añadidos`);
                    }
                }
            } catch (e: any) {
                errors++;
                log.error('[DiscoveryJob]', `USA Error: ${e.message}`);
            }

            // === PIPELINE 2: GLOBAL (Yahoo Engine) ===
            try {
                const targetCurrency = REGION_CURRENCY_MAP[targetRegion];
                const screenerId = isGlobalOpen ? 'day_gainers' : 'most_actives';

                log.info('[DiscoveryJob]', `Global Pipeline -> Region: ${targetRegion}, Estrategia: ${screenerId}`);

                // Fetch pool
                let pool = await MarketDataService.getDiscoveryCandidates(screenerId, 100, targetRegion, targetCurrency);

                if (pool.length > 0) {
                    pool = await MarketDataService.enrichSectors(pool); // Only needed for Yahoo raw candidates
                    const freshSet = await MarketDataService.checkFreshness(pool.map(c => c.t));
                    const selected: any[] = [];
                    const detailsBatch: any[] = [];

                    // Optimization: Batch Process
                    const BATCH_SIZE = 5;
                    const candidatesToProcess = pool.filter(cand => !freshSet.has(cand.t));

                    log.debug('[DiscoveryJob]', `Global: ${pool.length} candidatos, ${candidatesToProcess.length} a procesar`);

                    for (let i = 0; i < candidatesToProcess.length; i += BATCH_SIZE) {
                        if (selected.length >= volV10) break;

                        const chunk = candidatesToProcess.slice(i, i + BATCH_SIZE);
                        const promises = chunk.map(async (cand) => {
                            try {
                                const f = await MarketDataService.getFundamentals(cand.t);
                                if (f) {
                                    return {
                                        enriched: { ...cand, fund: { ...cand.fund, ...f } },
                                        detail: { ticker: cand.t, data: { ...f, price: cand.p, symbol: cand.t } }
                                    };
                                }
                            } catch (e: any) {
                                const msg = e?.message || '';
                                if (msg.includes('Quote not found') || msg.includes('internal-error')) {
                                    const parts = cand.t.split('.');
                                    await MarketDataService.markCatalogFailed(parts[0], parts[1] || '', msg);
                                }
                            }
                            return null;
                        });

                        const results = await Promise.all(promises);

                        results.forEach(res => {
                            if (res && selected.length < volV10) {
                                selected.push(res.enriched);
                                detailsBatch.push(res.detail);
                            }
                        });
                    }

                    // Bulk Save Details
                    if (detailsBatch.length > 0) {
                        await DiscoveryService.saveTickerDetailsBatch(detailsBatch);
                    }

                    if (selected.length > 0) {
                        await DiscoveryService.saveDiscoveryData(`global_${targetRegion.toLowerCase()}`, selected);
                        globalCount = selected.length;
                        log.verbose('[DiscoveryJob]', `Global -> ${selected.length} items en ${targetRegion}`);
                    }
                }
            } catch (e: any) {
                errors++;
                log.error('[DiscoveryJob]', `Global Error: ${e.message}`);
            }

            // Summary (always shown in production)
            log.summary('[DiscoveryJob]', `✅ Ciclo completado: USA=${usaCount}, Global=${globalCount}, Errores=${errors}`);

        } catch (error) {
            log.error('[DiscoveryJob]', 'Critical Error:', error);
        }
    },

    // Legacy
    async scanTrending() { await this.runDiscoveryCycle(); },
    async scanHybridPair() { await this.runDiscoveryCycle(); }
}
