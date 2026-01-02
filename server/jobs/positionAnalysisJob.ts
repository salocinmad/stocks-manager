/**
 * Position Analysis Job v2.1.0
 * 
 * Runs every 6 hours (00:00, 06:00, 12:00, 18:00) to precalculate
 * risk metrics and technical indicators for all positions.
 */

import sql from '../db';
import { MarketDataService } from '../services/marketData';
import { PositionAnalysisService } from '../services/positionAnalysisService';

export async function runPositionAnalysisJob() {
    console.log('[PositionAnalysisJob] Starting scheduled analysis calculations...');
    const startTime = Date.now();

    try {
        // Get all positions with quantity > 0
        const positions = await sql`
            SELECT DISTINCT p.id, p.ticker, p.portfolio_id 
            FROM positions p 
            WHERE p.quantity > 0.00000001
        `;

        console.log(`[PositionAnalysisJob] Found ${positions.length} active positions to analyze.`);

        let successCount = 0;
        let errorCount = 0;

        for (const pos of positions) {
            try {
                // Get historical prices
                const history = await MarketDataService.getDetailedHistory(pos.ticker, 1);

                if (history.length < 30) {
                    console.warn(`[PositionAnalysisJob] Insufficient history for ${pos.ticker}, skipping.`);
                    continue;
                }

                const prices = history.map((h: any) => Number(h.close));

                // Calculate technical indicators
                const technical = MarketDataService.getTechnicalIndicators(prices) || {
                    rsi: null,
                    sma50: null,
                    sma200: null,
                    trend: 'NEUTRAL'
                };

                // Calculate risk metrics
                const risk = await PositionAnalysisService.calculateRiskMetrics(pos.ticker);

                // Save to cache
                await PositionAnalysisService.saveToCache(pos.id, pos.ticker, technical, risk);

                successCount++;

                // Rate limit to avoid API overload
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (e: any) {
                console.error(`[PositionAnalysisJob] Error analyzing ${pos.ticker}:`, e.message);
                errorCount++;
            }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[PositionAnalysisJob] Completed in ${duration}s. Success: ${successCount}, Errors: ${errorCount}`);

    } catch (e) {
        console.error('[PositionAnalysisJob] Critical error:', e);
    }
}

// Export for manual execution
export default runPositionAnalysisJob;
