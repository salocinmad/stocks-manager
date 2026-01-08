import sql from '../db';
import { MarketDataService } from '../services/marketData';
import { log } from '../utils/logger';

/**
 * Market Events Sync Job
 * 
 * Syncs calendar events for US Top 20 + IBEX 35 + All User Portfolio Tickers.
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
const DAILY_START_HOUR = 1;

let isRunning = false;
let failedTickers: Map<string, number> = new Map();

export const MarketEventsSyncJob = {
    startScheduler() {
        log.info('[MarketEventsSync]', `Scheduler initialized. Daily run at ${DAILY_START_HOUR}:00`);

        setInterval(() => {
            const now = new Date();
            if (now.getHours() === DAILY_START_HOUR && now.getMinutes() === 0 && !isRunning) {
                log.info('[MarketEventsSync]', 'Triggering Daily Sync...');
                this.runFullCycle(4, 2 * 60 * 1000);
            }
        }, 60 * 1000);

        setTimeout(() => {
            log.info('[MarketEventsSync]', 'Triggering Startup Sync...');
            this.runFullCycle(3, 2 * 60 * 1000);
        }, 60 * 1000);
    },

    async getAllTickers(): Promise<string[]> {
        try {
            const userTickersResult = await sql`
                SELECT DISTINCT ticker FROM positions WHERE ticker IS NOT NULL
            `;
            const userTickers = userTickersResult.map(r => r.ticker);

            const uniqueTickers = new Set([
                ...BASE_MARKET_TICKERS,
                ...userTickers
            ]);

            return Array.from(uniqueTickers);
        } catch (error) {
            log.error('[MarketEventsSync]', 'Error fetching tickers:', error);
            return BASE_MARKET_TICKERS;
        }
    },

    async runFullCycle(batchSize: number, intervalMs: number) {
        if (isRunning) {
            log.warn('[MarketEventsSync]', 'Cycle already in progress, skipping.');
            return;
        }

        isRunning = true;
        failedTickers.clear();

        try {
            const allTickers = await this.getAllTickers();
            log.info('[MarketEventsSync]', `Starting cycle. Total: ${allTickers.length} tickers`);

            await this.processTickerList(allTickers, batchSize, intervalMs);

            // Retries
            while (failedTickers.size > 0) {
                const tickersToRetry = Array.from(failedTickers.keys()).filter(t => failedTickers.get(t)! < MAX_RETRIES);
                if (tickersToRetry.length === 0) break;

                log.verbose('[MarketEventsSync]', `Retrying ${tickersToRetry.length} failed tickers...`);
                await this.processTickerList(tickersToRetry, batchSize, intervalMs);
            }

            log.summary('[MarketEventsSync]', `✅ Cycle completed. ${allTickers.length} tickers processed.`);

        } catch (e: any) {
            log.error('[MarketEventsSync]', 'Cycle failed:', e.message);
        } finally {
            isRunning = false;
        }
    },

    async processTickerList(tickers: string[], batchSize: number, intervalMs: number) {
        for (let i = 0; i < tickers.length; i += batchSize) {
            const batch = tickers.slice(i, i + batchSize);
            log.debug('[MarketEventsSync]', `Batch ${Math.ceil((i + 1) / batchSize)}/${Math.ceil(tickers.length / batchSize)}: ${batch.join(', ')}`);

            await Promise.all(batch.map(ticker => this.syncTicker(ticker)));

            if (i + batchSize < tickers.length) {
                await new Promise(resolve => setTimeout(resolve, intervalMs));
            }
        }
    },

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

                const existing = await sql`
                    SELECT id FROM financial_events
                    WHERE ticker = ${ticker} 
                    AND event_type = ${dbEventType} 
                    AND event_date = ${eventDate} 
                    AND user_id IS NULL
                    LIMIT 1
                `;

                if (existing.length > 0) {
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

            log.debug('[MarketEventsSync]', `✓ ${ticker}: ${synced} events`);
            failedTickers.delete(ticker);
            return true;

        } catch (err: any) {
            const retryCount = (failedTickers.get(ticker) || 0) + 1;
            failedTickers.set(ticker, retryCount);
            log.verbose('[MarketEventsSync]', `✗ ${ticker} (attempt ${retryCount}/${MAX_RETRIES}): ${err.message}`);
            return false;
        }
    },

    getStatus() {
        return { isRunning, failedTickers: Array.from(failedTickers.entries()) };
    }
};
