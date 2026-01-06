import sql from '../db';
import YahooFinance from 'yahoo-finance2';
import { MarketDataService } from './marketData';

const yahooFinance = new YahooFinance();

export const CalendarService = {

    /**
     * Sync user portfolio events (Rolling 1 year)
     * Auto-runs every 6 hours
     */
    async syncUserEvents(userId: string): Promise<number> {
        let synced = 0;
        try {
            // Get user tickers from BOTH Portfolio and Watchlists
            const portfolioTickers = await sql`
                SELECT DISTINCT p.ticker 
                FROM positions p
                JOIN portfolios pf ON p.portfolio_id = pf.id
                WHERE pf.user_id = ${userId}
            `;

            const watchlistTickers = await sql`
                SELECT DISTINCT ticker 
                FROM watchlists 
                WHERE user_id = ${userId}
            `;

            // Combine and unique
            const allTickers = new Set([
                ...portfolioTickers.map(r => r.ticker),
                ...watchlistTickers.map(r => r.ticker)
            ]);

            console.log(`[Calendar] Syncing events for ${allTickers.size} tickers (Portfolio + Watchlist)`);

            // Import dynamically or assume it is available via import at top if possible
            // But since this is inside the object, we use the imported MarketDataService
            // Ensure MarketDataService is imported at file level using the tool if it wasn't already.
            // Based on my "view_file" earlier, it was NOT imported. I need to make sure I add the import.
            // ** Wait ** handling imports in replace_file_content is tricky if I only replace specific lines.
            // The user asked me significantly change the logic.
            // I will use MarketDataService here.

            for (const ticker of allTickers) {
                // Get consolidated events from MarketDataService (Same as Analysis Modal)
                const events = await MarketDataService.getCalendarEvents(ticker);

                for (const e of events) {
                    // Map event types
                    let dbEventType = 'other';
                    if (e.type === 'EARNINGS_RELEASE') dbEventType = 'earnings';
                    else if (e.type === 'DIVIDEND' && e.title.includes('Ex-')) dbEventType = 'ex_dividend';
                    else if (e.type === 'DIVIDEND') dbEventType = 'dividend_payment'; // Maybe just ignore or map?
                    // NOTE: CalendarScreen supports: earnings, ex_dividend, fed_meeting, bce_meeting, custom.
                    // If I map 'dividend_payment', it might appear as gray default.

                    // We stick to what CalendarScreen supports explicitly or important ones.
                    if (dbEventType === 'other' && e.type !== 'EARNINGS_RELEASE' && e.type !== 'DIVIDEND') continue;
                    if (dbEventType === 'dividend_payment') continue; // Skip payment dates for now? Or maintain consistency? 
                    // Analysis view shows them. Main calendar is busy. 
                    // Let's stick to earnings and ex-dividend for now as they are the most critical.

                    // Determine Status
                    const status = e.isConfirmed ? 'confirmed' : 'estimated';

                    await sql`
                        INSERT INTO financial_events (
                            user_id, ticker, event_type, event_date, 
                            title, description, is_custom, status, 
                            estimated_eps, dividend_amount
                        )
                        VALUES (
                            ${userId}, 
                            ${ticker}, 
                            ${dbEventType}, 
                            ${e.date.split('T')[0]}, 
                            ${e.title},
                            ${e.description},
                            false,
                            ${status},
                            ${e.data?.eps || null},
                            ${e.data?.dividend || null}
                        )
                        ON CONFLICT (user_id, ticker, event_type, event_date)
                        DO UPDATE SET 
                            status = EXCLUDED.status,
                            estimated_eps = EXCLUDED.estimated_eps,
                            dividend_amount = EXCLUDED.dividend_amount,
                            title = EXCLUDED.title,
                            description = EXCLUDED.description
                    `;

                    // Same issue with Upsert. Securest way for now is simple Insert on conflict nothing, 
                    // or implementing a cleanup phase before sync.
                    synced++;
                }
            }
        } catch (e) {
            console.error('[Calendar] Sync Error:', e);
        }
        return synced;
    },

    /**
     * Get Market Events (from database)
     * Returns confirmed events synced by the daily MarketEventsSyncJob
     * Events are stored with user_id = NULL for market-wide events
     */
    async getMarketEvents(days: number = 30): Promise<any[]> {
        try {
            console.log(`[Calendar] getMarketEvents called: days=${days}`);

            const today = new Date();
            const endDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

            const todayStr = today.toISOString().split('T')[0];
            const endStr = endDate.toISOString().split('T')[0];

            // Query database for market events (user_id IS NULL and status = 'confirmed')
            const results = await sql`
                SELECT 
                    id, ticker, event_type, 
                    to_char(event_date, 'YYYY-MM-DD') as event_date, 
                    title, description, is_custom, status, estimated_eps, dividend_amount
                FROM financial_events
                WHERE user_id IS NULL
                AND status = 'confirmed'
                AND event_date >= ${todayStr}
                AND event_date <= ${endStr}
                ORDER BY event_date ASC
                LIMIT 100
            `;

            console.log(`[Calendar] getMarketEvents returned ${results.length} confirmed events (before dedupe)`);

            // Deduplicate (One per company per day per type)
            const uniqueEvents: any[] = [];
            const seen = new Set<string>();

            for (const r of results) {
                const key = `${r.ticker}|${r.event_type}|${r.event_date}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueEvents.push(r);
                }
            }

            return uniqueEvents;
        } catch (e) {
            console.error('[Calendar] getMarketEvents Error:', e);
            return [];
        }
    },

    // Get events for a user within a date range
    async getEvents(userId: string, from: Date, to: Date) {
        const fromStr = from.toISOString().split('T')[0];
        const toStr = to.toISOString().split('T')[0];
        console.log(`[Calendar] getEvents called: userId=${userId}, from=${fromStr}, to=${toStr}`);

        const results = await sql`
SELECT 
                id, ticker, event_type, 
                to_char(event_date, 'YYYY-MM-DD') as event_date, 
                title, description, is_custom, status, estimated_eps, dividend_amount
            FROM financial_events
            WHERE user_id = ${userId}
            AND event_date >= ${fromStr}
            AND event_date <= ${toStr}
            ORDER BY event_date ASC
    `;
        console.log(`[Calendar] getEvents returned ${results.length} events for user ${userId}`);
        // Convert postgres-js Result to plain array for proper JSON serialization
        return [...results];
    },

    // Create a custom event
    async createEvent(userId: string, data: { ticker?: string; event_type: string; event_date: string; title: string; description?: string }) {
        const [event] = await sql`
            INSERT INTO financial_events(user_id, ticker, event_type, event_date, title, description, is_custom)
VALUES(
    ${userId},
    ${data.ticker || null},
    ${data.event_type},
    ${data.event_date},
    ${data.title},
    ${data.description || null},
    true
)
RETURNING *
    `;
        return event;
    },

    // Delete a custom event (only if user owns it and it's custom)
    async deleteEvent(userId: string, eventId: string): Promise<boolean> {
        const result = await sql`
            DELETE FROM financial_events
            WHERE id = ${eventId} AND user_id = ${userId} AND is_custom = true
            RETURNING id
    `;
        return result.length > 0;
    }

};
