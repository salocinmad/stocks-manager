import { MarketDataService } from '../services/marketData';
import { DiscoveryService } from '../services/discoveryService';
import { SettingsService } from '../services/settingsService';

/**
 * Catalog Enrichment Job (Enhanced Version)
 * 
 * Processes tickers from the global_tickers catalog with intelligent call budgeting.
 * Each company may consume 1-2 calls depending on historical data availability.
 * 
 * Respects admin-configured limits:
 * - CRAWLER_CYCLES_PER_HOUR: How often to run
 * - CRAWLER_VOL_YAHOO_V10: Total API calls budget per cycle
 */

export const CatalogEnrichmentJob = {
    lastRunTime: 0,
    isRunning: false,

    async runEnrichmentCycle(manual: boolean = false) {
        if (this.isRunning) {
            console.log('[CatalogEnrich] Ya está ejecutándose, saltando...');
            return;
        }

        const now = Date.now();

        try {
            this.isRunning = true;

            // 1. Check if enabled (skip this check if manual trigger)
            // Respects the global "Master Control" (CRAWLER_ENABLED) from UI
            if (!manual) {
                const enabled = await SettingsService.get('CRAWLER_ENABLED');
                if (enabled !== 'true') {
                    return;
                }
            }

            // 2. Cooling window (respects CRAWLER_CYCLES_PER_HOUR)
            const cyclesPerHour = parseInt(await SettingsService.get('CRAWLER_CYCLES_PER_HOUR') || '6');
            const cooldownMinutes = 60 / Math.max(1, Math.min(cyclesPerHour, 60));
            const minutesSinceLast = (now - this.lastRunTime) / 60000;

            if (!manual && minutesSinceLast < cooldownMinutes) {
                console.log(`[CatalogEnrich] ⏳ Cooldown activo. Faltan ${(cooldownMinutes - minutesSinceLast).toFixed(1)} min.`);
                return;
            }

            this.lastRunTime = now;

            // 3. Get call budget
            const callBudget = parseInt(await SettingsService.get('CRAWLER_VOL_YAHOO_V10') || '20');

            // 4. Get candidates from catalog
            const candidatePool = await MarketDataService.getCatalogCandidates(callBudget * 2);

            if (candidatePool.length === 0) {
                console.log('========================================');
                console.log('📖 Ciclo de Enriquecimiento');
                console.log('✅ No hay candidatos pendientes. Catálogo completo.');
                console.log('========================================');
                return;
            }

            // 5. Process candidates with call budget management
            const enriched: any[] = [];
            let callsUsed = 0;
            let companiesWithHistorical = 0;
            let companiesWithoutHistorical = 0;

            const addedList: { icon: string; name: string; sector: string }[] = [];
            const skippedList: { name: string; sector: string; reason: string }[] = [];

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

                        addedList.push({
                            icon: enhancedData.technical?.trend === 'Bullish' ? '📈' : '📉',
                            name: enhancedData.n || ticker,
                            sector: enhancedData.s || 'N/A'
                        });
                    } else {
                        // If we got here but price is 0 or invalid, behave as failure
                        console.warn(`[CatalogEnrich] ${ticker} returned empty/invalid data. Marking failed.`);
                        throw new Error(`Quote not found (empty result) for ${ticker}`);
                    }

                    await new Promise(resolve => setTimeout(resolve, 300));
                } catch (e: any) {
                    const partsInner = ticker.split('.');
                    const errorMsg = e.message || 'Unknown error';

                    // Check if this is a permanent failure
                    // Be more aggressive with error matching
                    const isPermanentFailure =
                        errorMsg.includes('Quote not found') ||
                        errorMsg.includes('internal-error') ||
                        errorMsg.includes('Symbol not found') ||
                        errorMsg.includes('No data available') ||
                        errorMsg.includes('Not Found');

                    if (isPermanentFailure) {
                        console.log(`[CatalogEnrich] ⛔ MARANDO FALLIDO: ${ticker} (Razón: ${errorMsg})`);
                        // Mark as failed so we skip this ticker in future cycles
                        await MarketDataService.markCatalogFailed(partsInner[0], partsInner[1] || '', errorMsg);
                        skippedList.push({
                            name: ticker,
                            sector: 'N/A',
                            reason: `⛔ MARCADO FALLIDO: ${errorMsg.substring(0, 50)}`
                        });
                    } else {
                        console.log(`[CatalogEnrich] ⚠️ Error temporal para ${ticker}: ${errorMsg}`);
                        // Temporary failure - just mark as processed to retry later (next week)
                        // This prevents infinite loops in THIS cycle, but allows retry later
                        await MarketDataService.markCatalogProcessed(partsInner[0], partsInner[1] || '');
                        skippedList.push({
                            name: ticker,
                            sector: 'N/A',
                            reason: `⚠️ Error temporal: ${errorMsg.substring(0, 50)}`
                        });
                    }
                }
            }

            // 6. Save to Discovery Engine
            if (enriched.length > 0) {
                await DiscoveryService.appendDiscoveryData('catalog_global', enriched);
            }

            // 7. FINAL STRUCTURED LOG OUTPUT
            console.log('\n========================================');
            console.log('📖 Iniciado Ciclo de Enriquecimiento');
            console.log(`⚙️  Presupuesto: ${callBudget} llamadas | Ciclos/h: ${cyclesPerHour}`);
            console.log('========================================');
            console.log('✅ Resumen:');
            console.log(`  ✔️  Empresas: ${addedList.length}`);
            console.log(`  📞 Llamadas: ${callsUsed}/${callBudget}`);
            console.log(`  ⚡ Reutilizó BD: ${companiesWithHistorical}`);
            console.log(`  🌐 Descargó nuevo: ${companiesWithoutHistorical}`);
            console.log(`  ⏭️  Saltadas: ${skippedList.length}`);
            console.log(`  💾 Guardadas: ${enriched.length} empresas en Discovery Engine (Modo Append)`);
            console.log('========================================');

            if (addedList.length > 0) {
                console.log('✅ Listado agregadas/actualizadas:');
                for (const item of addedList) {
                    console.log(`  ${item.icon} ${item.name}, ${item.sector}`);
                }
                console.log('========================================');
            }

            if (skippedList.length > 0) {
                console.log('✅ Listado Saltadas:');
                for (const item of skippedList) {
                    console.log(`  ⏭️  ${item.name}, ${item.sector}, ${item.reason}`);
                }
                console.log('========================================\n');
            }

        } catch (error) {
            console.error('[CatalogEnrich] Error crítico:', error);
        } finally {
            this.isRunning = false;
        }
    }
};
