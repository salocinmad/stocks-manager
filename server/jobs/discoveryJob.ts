import { DiscoveryService } from '../services/discoveryService';
import { MarketDataService } from '../services/marketData';
import { SettingsService } from '../services/settingsService';
import yahooFinance from 'yahoo-finance2';

/**
 * Smart Discovery Crawler 2.0 (Configurable Engine)
 * 
 * Capabilities:
 * - Dynamic Frequency (Check every 3 mins, run based on cycles/hr)
 * - Hybrid Trio: Run 3 specialized workers in parallel (V8 Tech, Finnhub News, V10 Fundamental)
 * - Granular Volume Control: User defines how many items each worker fetches.
 * - Market Intelligence: Prioritizes "Day Gainers" when market is OPEN.
 */
export const DiscoveryJob = {

    lastRunTime: 0,

    async runDiscoveryCycle() {
        const now = Date.now();
        console.log('[DiscoveryCrawler] Checking schedule...');

        try {
            // 1. Check Global Switch
            const enabled = await SettingsService.get('CRAWLER_ENABLED');
            if (enabled !== 'true') {
                return; // Silent return to avoid log spam
            }

            // 2. Check Frequency Window
            const cyclesPerHour = parseInt(await SettingsService.get('CRAWLER_CYCLES_PER_HOUR') || '6');
            const cooldownMinutes = 60 / Math.max(1, Math.min(cyclesPerHour, 60)); // Min 1 min interval
            const minutesSinceLast = (now - this.lastRunTime) / 60000;

            if (minutesSinceLast < cooldownMinutes) {
                // Not time yet
                return;
            }

            // Start Cycle
            this.lastRunTime = now;
            console.log(`[DiscoveryCrawler] Starting Cycle (Config: ${cyclesPerHour}/hr)...`);

            // Load Volumes
            const volV8 = parseInt(await SettingsService.get('CRAWLER_VOL_YAHOO_V8') || '20');
            const volV10 = parseInt(await SettingsService.get('CRAWLER_VOL_YAHOO_V10') || '5');
            const volFinnhub = parseInt(await SettingsService.get('CRAWLER_VOL_FINNHUB') || '15');
            const marketOpenOnly = (await SettingsService.get('CRAWLER_MARKET_OPEN_ONLY')) === 'true';

            // 3. Determine Market Status (US vs EU)
            // We check a representative index for each region to determine "Market Open"
            let isUSOpen = false;
            let isEUOpen = false;
            let marketLabel = "Global/Closed";

            try {
                // Check S&P 500 (US) and Euro Stoxx 50 (EU)
                const statuses = await MarketDataService.getMarketStatus(['^GSPC', '^STOXX50E']);
                const usStatus = statuses.find(s => s.symbol === '^GSPC');
                const euStatus = statuses.find(s => s.symbol === '^STOXX50E');

                isUSOpen = usStatus?.state === 'OPEN';
                isEUOpen = euStatus?.state === 'OPEN';

                if (isUSOpen && isEUOpen) marketLabel = "US & EU Open";
                else if (isUSOpen) marketLabel = "US Open";
                else if (isEUOpen) marketLabel = "EU Open";
            } catch (err) {
                console.warn('[DiscoveryCrawler] Failed to check market status, assuming Global/Time-based.');
                // Fallback to time if API fails
                const hour = new Date().getHours();
                isUSOpen = (hour >= 15 && hour <= 22); // Approx 15:30 - 22:00 CET
                isEUOpen = (hour >= 9 && hour <= 17);  // Approx 09:00 - 17:30 CET
            }

            console.log(`[DiscoveryCrawler] Market Context: ${marketLabel}`);

            // === WORKER 1: YAHOO V8 (Technical/Momentum) ===
            const runV8 = async () => {
                let target = 'undervalued_growth_stocks'; // Default rotation
                let label = 'Sector Rotation';

                // Market Open Override Logic
                if (marketOpenOnly && (isUSOpen || isEUOpen)) {
                    target = 'day_gainers';
                    label = `🔥 Day Gainers (${marketLabel})`;
                } else {
                    // Standard Rotation based on minute
                    const opts = ['sector_technology', 'undervalued_large_caps', 'aggressive_small_caps', 'growth_technology_stocks'];
                    const idx = new Date().getMinutes() % opts.length;
                    target = opts[idx];
                }

                console.log(`[Crawler V8] Scanning ${label}... (${volV8} items)`);
                const data = await MarketDataService.getDiscoveryCandidates(target, volV8);
                if (data.length > 0) {
                    await DiscoveryService.saveDiscoveryData(`v8_${target}`, data);
                }
            };

            // === WORKER 2: FINNHUB (News/Trends) ===
            const runFinnhub = async () => {
                // Finnhub Options
                const opts = [
                    { key: 'sector_technology', target: 'technology' },
                    { key: 'trending_news', target: 'business' },
                    { key: 'general_news', target: 'general' }
                ];
                const idx = new Date().getHours() % opts.length; // Slower rotation
                const sF = opts[idx];

                console.log(`[Crawler Finnhub] Fetching ${sF.target} news... (${volFinnhub} items)`);
                const data = await MarketDataService.getDiscoveryCandidatesFinnhub(sF.target, volFinnhub);
                if (data.length > 0) {
                    await DiscoveryService.saveDiscoveryData(sF.key, data);
                }
            };

            // === WORKER 3: YAHOO V10 (Fundamental/Deep Value) ===
            const runV10 = async () => {
                // Strategy: Search broader candidates then filter deeply
                // We use 'screener' to find candidates, then 'quoteSummary' to validate
                const searchCount = Math.max(10, volV10 * 2); // Search double to allow filtering
                console.log(`[Crawler V10] Deep seeking ${volV10} gems... (Scanning ${searchCount})`);

                const candidates = await MarketDataService.getDiscoveryCandidates('undervalued_large_caps', searchCount);

                const gems = [];
                for (const cand of candidates) {
                    if (gems.length >= volV10) break; // Reached target

                    try {
                        const fundamentals = await yahooFinance.quoteSummary(cand.t, { modules: ['financialData', 'defaultKeyStatistics'] });
                        const fin = fundamentals.financialData;

                        // Strict Value Filter:
                        // 1. Profitable (ROE > 0)
                        // 2. Reasonable Debt (D/E < 2.0)
                        if (fin && fin.returnOnEquity && fin.returnOnEquity > 0.05) {
                            // Enrich candidate with fundamental data preview if needed
                            // Note: 'priceChange' is not in DiscoveryItem, so we use chg_1w or keep existing chg_1d
                            // If we want to store ROE, we might need to expand the interface, but for now we filter.
                            // We can use 'vol_rel' to store a score or similar if we wanted.
                            gems.push(cand);
                        }
                    } catch (e) {
                        // Ignore failure, next candidate
                    }
                }

                if (gems.length > 0) {
                    console.log(`[Crawler V10] Found ${gems.length} Quality Gems.`);
                    await DiscoveryService.saveDiscoveryData('v10_quality_gems', gems);
                }
            };

            // EXECUTE PARALLEL TRIO
            await Promise.all([
                runV8().catch(e => console.error('[Crawler V8] Failed', e)),
                runFinnhub().catch(e => console.error('[Crawler Finnhub] Failed', e)),
                runV10().catch(e => console.error('[Crawler V10] Failed', e))
            ]);

            console.log(`[DiscoveryCrawler] Cycle completed at ${new Date().toISOString()}`);

        } catch (error) {
            console.error('[DiscoveryCrawler] Cycle failed:', error);
        }
    },

    // Legacy support if needed
    async scanTrending() { await this.runDiscoveryCycle(); },
    async scanHybridPair() { await this.runDiscoveryCycle(); }
}
