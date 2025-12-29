import sql from '../db';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

export const CalendarService = {
    // Get earnings dates for a ticker
    async getEarningsDates(ticker: string): Promise<{ date: Date; type: string }[]> {
        try {
            const result = await yahooFinance.quoteSummary(ticker, { modules: ['calendarEvents'] });
            const events: { date: Date; type: string }[] = [];

            if (result?.calendarEvents?.earnings?.earningsDate) {
                for (const date of result.calendarEvents.earnings.earningsDate) {
                    events.push({ date: new Date(date), type: 'earnings' });
                }
            }

            return events;
        } catch (e) {
            console.error(`Failed to get earnings for ${ticker}:`, e);
            return [];
        }
    },

    // Get ex-dividend date for a ticker
    async getExDividendDate(ticker: string): Promise<Date | null> {
        try {
            const result = await yahooFinance.quoteSummary(ticker, { modules: ['summaryDetail'] });
            if (result?.summaryDetail?.exDividendDate) {
                return new Date(result.summaryDetail.exDividendDate);
            }
            return null;
        } catch (e) {
            console.error(`Failed to get dividend date for ${ticker}:`, e);
            return null;
        }
    },

    // Sync financial events for all tickers in user's portfolio
    async syncUserEvents(userId: string): Promise<number> {

        let synced = 0;

        // Get all tickers from user's portfolios
        const positions = await sql`
            SELECT DISTINCT p.ticker 
            FROM positions p
            JOIN portfolios pf ON p.portfolio_id = pf.id
            WHERE pf.user_id = ${userId}
        `;

        for (const pos of positions) {
            const ticker = pos.ticker;

            // Get earnings dates
            const earnings = await this.getEarningsDates(ticker);
            for (const e of earnings) {
                // Upsert: avoid duplicates
                await sql`
                    INSERT INTO financial_events (user_id, ticker, event_type, event_date, title, is_custom)
                    VALUES (
                        ${userId}, 
                        ${ticker}, 
                        'earnings', 
                        ${e.date.toISOString().split('T')[0]}, 
                        ${`Resultados ${ticker}`},
                        false
                    )
                    ON CONFLICT DO NOTHING
                `;
                synced++;
            }

            // Get ex-dividend date
            const exDiv = await this.getExDividendDate(ticker);
            if (exDiv && exDiv > new Date()) {
                await sql`
                    INSERT INTO financial_events (user_id, ticker, event_type, event_date, title, is_custom)
                    VALUES (
                        ${userId}, 
                        ${ticker}, 
                        'ex_dividend', 
                        ${exDiv.toISOString().split('T')[0]}, 
                        ${`Ex-Dividendo ${ticker}`},
                        false
                    )
                    ON CONFLICT DO NOTHING
                `;
                synced++;
            }
        }


        return synced;
    },

    // Get events for a user within a date range
    async getEvents(userId: string, from: Date, to: Date) {
        return await sql`
            SELECT * FROM financial_events
            WHERE user_id = ${userId}
            AND event_date >= ${from.toISOString().split('T')[0]}
            AND event_date <= ${to.toISOString().split('T')[0]}
            ORDER BY event_date ASC
        `;
    },

    // Create a custom event
    async createEvent(userId: string, data: { ticker?: string; event_type: string; event_date: string; title: string; description?: string }) {
        const [event] = await sql`
            INSERT INTO financial_events (user_id, ticker, event_type, event_date, title, description, is_custom)
            VALUES (
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
