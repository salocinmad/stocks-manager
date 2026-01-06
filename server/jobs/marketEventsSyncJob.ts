import sql from '../db';
import { MarketDataService } from '../services/marketData';

/**
 * Market Events Sync Job
 * 
 * Syncs calendar events for US Top 20 + IBEX 35 + All User Portfolio Tickers.
 * 
 * Schedules:
 * 1. Daily at 1:00 AM: Full sync (4 tickers every 2 min)
 * 2. On Startup: Full sync (3 tickers every 2 min)
 */

// Base list: US Top 20 + IBEX 35 tickers
const BASE_MARKET_TICKERS = [
    // US Top 20
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'JNJ',
    'WMT', 'PG', 'HD', 'MA', 'BAC', 'XOM', 'PFE', 'CSCO', 'INTC', 'DIS',
    // IBEX 35 (Spain)
    'ITX.MC', 'SAN.MC', 'BBVA.MC', 'IBE.MC', 'TEF.MC', 'REP.MC', 'ACS.MC', 'FER.MC',
    'ENG.MC', 'GRF.MC', 'AMS.MC', 'CABK.MC', 'MAP.MC', 'AENA.MC', 'IAG.MC', 'CLNX.MC',
    'RED.MC', 'IDR.MC', 'MTS.MC', 'COL.MC', 'SAB.MC', 'MEL.MC', 'LOG.MC', 'ACX.MC',
    'PHM.MC', 'SGRE.MC', 'NTGY.MC', 'ROV.MC', 'VIS.MC', 'CIE.MC', 'ANA.MC', 'GCO.MC',
    'SLR.MC', 'UNI.MC', 'BKT.MC'
];

const MAX_RETRIES = 3;
const DAILY_START_HOUR = 1; // 1:00 AM

// Sync state
let isRunning = false;
let failedTickers: Map<string, number> = new Map(); // ticker -> retry count

export const MarketEventsSyncJob = {
    /**
     * Start the scheduler
     */
    startScheduler() {
        console.log(`[MarketEventsSync] Scheduler initialized. Daily run at ${DAILY_START_HOUR}:00`);

        // 1. Daily Scheduler (Check every minute)
        setInterval(() => {
            const now = new Date();
            // Run at 1:00 AM if not running
            if (now.getHours() === DAILY_START_HOUR && now.getMinutes() === 0 && !isRunning) {
                console.log('[MarketEventsSync] Triggering Daily Sync (4 tickers / 2 min)...');
                this.runFullCycle(4, 2 * 60 * 1000); // 4 tickers every 2 min
            }
        }, 60 * 1000);

        // 2. Startup Sync (Runs 1 min after startup)
        // 3 tickers every 2 min
        setTimeout(() => {
            console.log('[MarketEventsSync] Triggering Startup Sync (3 tickers / 2 min)...');
            this.runFullCycle(3, 2 * 60 * 1000);
        }, 60 * 1000);
    },

    /**
     * Build the full list of tickers: Base List + User Portfolios
     */
    async getAllTickers(): Promise<string[]> {
        try {
            // Get all distinct tickers from user positions
            const userTickersResult = await sql`
                SELECT DISTINCT ticker FROM positions WHERE ticker IS NOT NULL
            `;
            const userTickers = userTickersResult.map(r => r.ticker);

            // Combine and deduplicate
            const uniqueTickers = new Set([
                ...BASE_MARKET_TICKERS,
                ...userTickers
            ]);

            return Array.from(uniqueTickers);
        } catch (error) {
            console.error('[MarketEventsSync] Error fetching tickers:', error);
            return BASE_MARKET_TICKERS; // Fallback to base list
        }
    },

    /**
     * Run a full sync cycle
     * @param batchSize Number of tickers per batch
     * @param intervalMs Interval between batches in ms
     */
    async runFullCycle(batchSize: number, intervalMs: number) {
        if (isRunning) {
            console.log('[MarketEventsSync] Cycle already in progress, skipping request.');
            return;
        }

        isRunning = true;
        failedTickers.clear();

        try {
            const allTickers = await this.getAllTickers();
            console.log(`[MarketEventsSync] Starting cycle. Total tickers: ${allTickers.length}`);
            console.log(`[MarketEventsSync] Configuration: Batch=${batchSize}, Interval=${intervalMs / 1000}s`);

            // First pass
            await this.processTickerList(allTickers, batchSize, intervalMs);

            // Retries
            while (failedTickers.size > 0) {
                const tickersToRetry = Array.from(failedTickers.keys()).filter(t => failedTickers.get(t)! < MAX_RETRIES);

                if (tickersToRetry.length === 0) break;

                console.log(`[MarketEventsSync] Retrying ${tickersToRetry.length} failed tickers...`);
                // Use same pacing for retries
                await this.processTickerList(tickersToRetry, batchSize, intervalMs);
            }

            console.log(`[MarketEventsSync] Cycle completed at ${new Date().toISOString()}`);

        } catch (e: any) {
            console.error('[MarketEventsSync] Cycle failed:', e.message);
        } finally {
            isRunning = false;
        }
    },

    /**
     * Process list in batches
     */
    async processTickerList(tickers: string[], batchSize: number, intervalMs: number) {
        for (let i = 0; i < tickers.length; i += batchSize) {
            const batch = tickers.slice(i, i + batchSize);
            console.log(`[MarketEventsSync] Batch ${Math.ceil((i + 1) / batchSize)}/${Math.ceil(tickers.length / batchSize)}: ${batch.join(', ')}`);

            // Process batch in parallel
            await Promise.all(batch.map(ticker => this.syncTicker(ticker)));

            // Wait interval (unless it's the last batch)
            if (i + batchSize < tickers.length) {
                await new Promise(resolve => setTimeout(resolve, intervalMs));
            }
        }
    },

    /**
     * Sync single ticker
     */
    async syncTicker(ticker: string): Promise<boolean> {
        try {
            const events = await MarketDataService.getCalendarEvents(ticker);
            const confirmedEvents = events.filter(e => e.isConfirmed === true);

            let synced = 0;
            for (const e of confirmedEvents) {
                const dbEventType = e.type === 'EARNINGS_RELEASE' ? 'earnings' :
                    e.type === 'DIVIDEND' && e.title.includes('Ex-') ? 'ex_dividend' : 'other';

                if (dbEventType === 'other') continue;

                const eventDate = e.date.split('T')[0];

                // Check for existing event for this ticker/date/type (User ID NULL)
                const existing = await sql`
                    SELECT id FROM financial_events
                    WHERE ticker = ${ticker} 
                    AND event_type = ${dbEventType} 
                    AND event_date = ${eventDate} 
                    AND user_id IS NULL
                    LIMIT 1
                `;

                if (existing.length > 0) {
                    // Update existing
                    await sql`
                        UPDATE financial_events SET
                            status = 'confirmed',
                            estimated_eps = ${e.data?.eps || null},
                            dividend_amount = ${e.data?.dividend || null},
                            title = ${e.title},
                            description = ${e.description},
                            updated_at = NOW()
                        WHERE id = ${existing[0].id}
                    `;
                } else {
                    // Insert new
                    await sql`
                        INSERT INTO financial_events (
                            user_id, ticker, event_type, event_date, 
                            title, description, is_custom, status, 
                            estimated_eps, dividend_amount
                        )
                        VALUES (
                            NULL, ${ticker}, ${dbEventType}, ${eventDate}, 
                            ${e.title}, ${e.description}, false, 'confirmed',
                            ${e.data?.eps || null}, ${e.data?.dividend || null}
                        )
                    `;
                }
                synced++;
            }

            console.log(`[MarketEventsSync] ✓ ${ticker}: ${synced} events`);
            failedTickers.delete(ticker);
            return true;

        } catch (err: any) {
            const retryCount = (failedTickers.get(ticker) || 0) + 1;
            failedTickers.set(ticker, retryCount);
            console.error(`[MarketEventsSync] ✗ ${ticker} (attempt ${retryCount}/${MAX_RETRIES}): ${err.message}`);
            return false;
        }
    },

    getStatus() {
        return { isRunning, failedTickers: Array.from(failedTickers.entries()) };
    }
};
