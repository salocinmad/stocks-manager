import { DiscoveryService } from '../services/discoveryService';
import { MarketDataService } from '../services/marketData';
import { SettingsService } from '../services/settingsService';

/**
 * Smart Discovery Crawler 4.0 (Market-Aware Dual Pipeline)
 * 
 * Strategy:
 * - Executes BOTH US (Finnhub) and Global (Yahoo) pipelines in every cycle.
 * - Strategy selection based on Market Status (Open vs Closed).
 * - 7-Day Freshness Filter to optimize API calls.
 */

const US_OPEN_SCREENERS = ['day_gainers', 'most_actives'];
const US_CLOSED_SCREENERS = [
    'growth_technology_stocks',
    'undervalued_large_caps',
    'undervalued_growth_stocks',
    'aggressive_small_caps',
    'top_mutual_funds'
];

const GLOBAL_REGIONS = ['DE', 'ES', 'GB', 'FR', 'IT', 'HK', 'AU'];
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

export const DiscoveryJob = {
    lastRunTime: 0,

    async runDiscoveryCycle() {
        const now = Date.now();

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
            console.log(`[DiscoveryJob] Iniciando Ciclo Market-Aware (${cyclesPerHour}/hr)...`);

            // 3. Load Tuning params
            const volFinnhub = parseInt(await SettingsService.get('CRAWLER_VOL_FINNHUB') || '20');
            const volV10 = parseInt(await SettingsService.get('CRAWLER_VOL_YAHOO_V10') || '20');

            // 4. Determine Market Statuses
            const targetRegion = GLOBAL_REGIONS[Math.floor(Math.random() * GLOBAL_REGIONS.length)];
            const statusResults = await MarketDataService.getMarketStatus(['^IXIC', REGION_INDEX_MAP[targetRegion]]);

            const usStatus = statusResults.find(s => s.symbol === '^IXIC')?.state || 'CLOSED';
            const globalStatus = statusResults.find(s => s.symbol === REGION_INDEX_MAP[targetRegion])?.state || 'CLOSED';

            const isUsOpen = usStatus === 'REGULAR';
            const isGlobalOpen = globalStatus === 'REGULAR';

            console.log(`[DiscoveryJob] Status -> USA: ${usStatus}, ${targetRegion}: ${globalStatus}`);

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

                console.log(`[DiscoveryJob] USA Pipeline -> Motor: Finnhub, Estrategia: ${screener} (${fhCategory})`);

                const fhItems = await MarketDataService.getDiscoveryCandidatesFinnhub(fhCategory, 50); // Get more candidates to filter

                if (fhItems.length > 0) {
                    const freshSet = await MarketDataService.checkFreshness(fhItems.map(c => c.t));
                    const selected: any[] = [];

                    for (const item of fhItems) {
                        if (selected.length >= volFinnhub) break;
                        if (freshSet.has(item.t)) continue; // SKIP if updated in last 7 days

                        try {
                            const f = await MarketDataService.getFundamentals(item.t);
                            if (f) {
                                selected.push({ ...item, fund: { ...item.fund, ...f } });
                                // Save DEEP data to ticker_details_cache (for Modal)
                                await DiscoveryService.saveTickerDetails(item.t, { ...f, price: item.p, symbol: item.t });
                            }
                        } catch (e: any) {
                            // Mark permanent failures to skip in future
                            const msg = e?.message || '';
                            if (msg.includes('Quote not found') || msg.includes('internal-error')) {
                                const parts = item.t.split('.');
                                await MarketDataService.markCatalogFailed(parts[0], parts[1] || '', msg);
                            }
                        }
                    }

                    if (selected.length > 0) {
                        await DiscoveryService.saveDiscoveryData(`us_${fhCategory}`, selected);
                        console.log(`[DiscoveryJob] USA -> Añadidos/Actualizados ${selected.length} items.`);
                    }
                }
            } catch (e: any) {
                console.error(`[DiscoveryJob] USA Error: ${e.message}`);
            }

            // === PIPELINE 2: GLOBAL (Yahoo Engine) ===
            try {
                const targetCurrency = REGION_CURRENCY_MAP[targetRegion];
                const screenerId = isGlobalOpen ? 'day_gainers' : 'most_actives';

                console.log(`[DiscoveryJob] Global Pipeline -> Region: ${targetRegion}, Estrategia: ${screenerId}`);

                // Fetch pool (larger to account for sovereign filter)
                let pool = await MarketDataService.getDiscoveryCandidates(screenerId, 100, targetRegion, targetCurrency);

                if (pool.length > 0) {
                    pool = await MarketDataService.enrichSectors(pool);
                    const freshSet = await MarketDataService.checkFreshness(pool.map(c => c.t));
                    const selected: any[] = [];

                    for (const cand of pool) {
                        if (selected.length >= volV10) break;
                        if (freshSet.has(cand.t)) continue; // SKIP if updated in last 7 days

                        try {
                            const f = await MarketDataService.getFundamentals(cand.t);
                            if (f) {
                                selected.push({ ...cand, fund: { ...cand.fund, ...f } });
                                // Save DEEP data to ticker_details_cache (for Modal)
                                await DiscoveryService.saveTickerDetails(cand.t, { ...f, price: cand.p, symbol: cand.t });
                            }
                        } catch (e: any) {
                            // Mark permanent failures to skip in future
                            const msg = e?.message || '';
                            if (msg.includes('Quote not found') || msg.includes('internal-error')) {
                                const parts = cand.t.split('.');
                                await MarketDataService.markCatalogFailed(parts[0], parts[1] || '', msg);
                            }
                        }
                    }

                    if (selected.length > 0) {
                        await DiscoveryService.saveDiscoveryData(`global_${targetRegion.toLowerCase()}`, selected);
                        console.log(`[DiscoveryJob] Global -> Añadidos/Actualizados ${selected.length} items en ${targetRegion}.`);
                    }
                }
            } catch (e: any) {
                console.error(`[DiscoveryJob] Global Error: ${e.message}`);
            }

            console.log(`[DiscoveryJob] Ciclo finalizado a las ${new Date().toISOString()}`);

        } catch (error) {
            console.error('[DiscoveryJob] Critical Error:', error);
        }
    },

    // Legacy
    async scanTrending() { await this.runDiscoveryCycle(); },
    async scanHybridPair() { await this.runDiscoveryCycle(); }
}
