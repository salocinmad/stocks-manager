import { MarketDataService } from '../services/marketData';
import { DiscoveryService } from '../services/discoveryService';
import { SettingsService } from '../services/settingsService';
import { log } from '../utils/logger';

/**
 * Catalog Enrichment Job (Enhanced Version)
 * 
 * Processes tickers from the global_tickers catalog with intelligent call budgeting.
 * Each company may consume 1-2 calls depending on historical data availability.
 */

export const CatalogEnrichmentJob = {
    lastRunTime: 0,
    isRunning: false,

    async runEnrichmentCycle(manual: boolean = false) {
        if (this.isRunning) {
            log.warn('[CatalogEnrich]', 'Already running, skipping...');
            return;
        }

        const now = Date.now();

        try {
            this.isRunning = true;

            // 1. Check if enabled (skip this check if manual trigger)
            if (!manual) {
                const enabled = await SettingsService.get('CRAWLER_ENABLED');
                if (enabled !== 'true') {
                    return;
                }
            }

            // 2. Cooling window
            const cyclesPerHour = parseInt(await SettingsService.get('CRAWLER_CYCLES_PER_HOUR') || '6');
            const cooldownMinutes = 60 / Math.max(1, Math.min(cyclesPerHour, 60));
            const minutesSinceLast = (now - this.lastRunTime) / 60000;

            if (!manual && minutesSinceLast < cooldownMinutes) {
                log.debug('[CatalogEnrich]', `Cooldown active. ${(cooldownMinutes - minutesSinceLast).toFixed(1)} min remaining.`);
                return;
            }

            this.lastRunTime = now;

            // 3. Get call budget
            const callBudget = parseInt(await SettingsService.get('CRAWLER_VOL_YAHOO_V10') || '20');

            // 4. Get candidates from catalog
            const candidatePool = await MarketDataService.getCatalogCandidates(callBudget * 2);

            if (candidatePool.length === 0) {
                log.summary('[CatalogEnrich]', '✅ No candidates pending. Catalog complete.');
                return;
            }

            log.info('[CatalogEnrich]', `Starting cycle: ${candidatePool.length} candidates, budget: ${callBudget} calls`);

            // 5. Process candidates with call budget management
            const enriched: any[] = [];
            let callsUsed = 0;
            let companiesWithHistorical = 0;
            let companiesWithoutHistorical = 0;
            let skippedCount = 0;

            for (const candidate of candidatePool) {
                const { ticker, isin, symbol, exchange } = candidate;

                const hasHistorical = await MarketDataService.checkHistoricalFreshness(ticker);
                const callsNeeded = hasHistorical ? 1 : 2;

                if (callsUsed + callsNeeded > callBudget) {
                    break;
                }

                try {
                    const enhancedData = await MarketDataService.getEnhancedQuoteData(ticker, isin);

                    if (enhancedData && enhancedData.p > 0) {
                        callsUsed += enhancedData.callsUsed || callsNeeded;
                        if (hasHistorical) {
                            companiesWithHistorical++;
                        } else {
                            companiesWithoutHistorical++;
                        }

                        const { callsUsed: _, ...dataToSave } = enhancedData;
                        enriched.push(dataToSave);
                        await MarketDataService.markCatalogProcessed(symbol, exchange || '');

                        log.debug('[CatalogEnrich]', `✓ ${ticker}: ${enhancedData.n || 'N/A'}`);
                    } else {
                        throw new Error(`Quote not found (empty result) for ${ticker}`);
                    }

                    await new Promise(resolve => setTimeout(resolve, 300));
                } catch (e: any) {
                    const partsInner = ticker.split('.');
                    const errorMsg = e.message || 'Unknown error';

                    const isPermanentFailure =
                        errorMsg.includes('Quote not found') ||
                        errorMsg.includes('internal-error') ||
                        errorMsg.includes('Symbol not found') ||
                        errorMsg.includes('No data available') ||
                        errorMsg.includes('Not Found');

                    if (isPermanentFailure) {
                        log.verbose('[CatalogEnrich]', `⛔ Marked failed: ${ticker}`);
                        await MarketDataService.markCatalogFailed(partsInner[0], partsInner[1] || '', errorMsg);
                    } else {
                        log.verbose('[CatalogEnrich]', `⚠️ Temp error for ${ticker}: ${errorMsg.substring(0, 50)}`);
                        await MarketDataService.markCatalogProcessed(partsInner[0], partsInner[1] || '');
                    }
                    skippedCount++;
                }
            }

            // 6. Save to Discovery Engine
            if (enriched.length > 0) {
                await DiscoveryService.appendDiscoveryData('catalog_global', enriched);
            }

            // 7. Summary log (always shown in production)
            log.summary('[CatalogEnrich]',
                `✅ Cycle completed: ${enriched.length} enriched, ${callsUsed}/${callBudget} calls, ` +
                `${companiesWithHistorical} cached, ${companiesWithoutHistorical} new, ${skippedCount} skipped`
            );

        } catch (error) {
            log.error('[CatalogEnrich]', 'Critical error:', error);
        } finally {
            this.isRunning = false;
        }
    }
};
