/**
 * PnL Pre-calculation Job
 * - Daily at 4:00 AM: Calculate last 5 days
 * - Weekly (Sunday) at 4:00 AM: Calculate full 6 months
 * 
 * Uses transactions history to determine which positions were open on each day.
 */

import sql from '../db';
import { MarketDataService } from '../services/marketData';

// Get positions that were open on a specific date based on transactions
async function getPositionsOnDate(portfolioId: string, dateStr: string): Promise<Map<string, { qty: number, avgPrice: number, currency: string }>> {
    const positionsMap = new Map<string, { qty: number, avgPrice: number, currency: string }>();

    // Get all BUY/SELL transactions up to and including this date
    const transactions = await sql`
        SELECT ticker, type, amount, price_per_unit, currency, date
        FROM transactions
        WHERE portfolio_id = ${portfolioId}
        AND date::date <= ${dateStr}::date
        ORDER BY date ASC
    `;

    // Calculate running totals per ticker
    for (const tx of transactions) {
        const ticker = (tx.ticker || '').toUpperCase();
        const type = tx.type;
        const amount = Number(tx.amount) || 0;
        const price = Number(tx.price_per_unit) || 0;
        const currency = (tx.currency || 'EUR').toUpperCase();

        const current = positionsMap.get(ticker) || { qty: 0, avgPrice: 0, currency };

        if (type === 'BUY') {
            // Recalculate average price
            const totalCost = (current.qty * current.avgPrice) + (amount * price);
            const newQty = current.qty + amount;
            current.qty = newQty;
            current.avgPrice = newQty > 0 ? totalCost / newQty : 0;
            current.currency = currency;
        } else if (type === 'SELL') {
            current.qty = Math.max(0, current.qty - amount);
            // avgPrice stays the same for remaining shares
        }

        if (current.qty > 0) {
            positionsMap.set(ticker, current);
        } else {
            positionsMap.delete(ticker); // Position fully closed
        }
    }

    return positionsMap;
}

// Calculate PnL for a specific date range (uses only trading days)
async function calculatePnLForDateRange(portfolioId: string, startDate: Date, endDate: Date): Promise<void> {
    console.log(`[PnL Job] Portfolio ${portfolioId}: calculating from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    // Get all tickers from transactions for this portfolio FIRST
    const allTickers = await sql`
        SELECT DISTINCT UPPER(ticker) as ticker FROM transactions WHERE portfolio_id = ${portfolioId}
    `;
    const tickers = allTickers.map((t: any) => t.ticker).filter(Boolean);

    if (tickers.length === 0) {
        console.log(`[PnL Job] Portfolio ${portfolioId} has no transactions, skipping.`);
        return;
    }

    // Get ONLY trading days (dates that exist in historical_data for ANY of the tickers)
    // This avoids weekends and holidays automatically
    const tradingDays = await sql`
        SELECT DISTINCT date::date as date
        FROM historical_data
        WHERE ticker = ANY(${tickers})
        AND date >= ${startDate.toISOString().split('T')[0]}::date
        AND date <= ${endDate.toISOString().split('T')[0]}::date
        ORDER BY date ASC
    `;

    const dates = tradingDays.map((row: any) => new Date(row.date).toISOString().split('T')[0]);

    if (dates.length === 0) {
        console.log(`[PnL Job] Portfolio ${portfolioId} has no trading days in range, skipping.`);
        return;
    }

    console.log(`[PnL Job] Portfolio ${portfolioId}: found ${dates.length} trading days`);

    // Fetch historical prices for all tickers
    const historyData: Record<string, any[]> = {};
    for (const ticker of tickers) {
        try {
            await MarketDataService.getDetailedHistory(ticker, 1);
            const hist = await sql`
                SELECT date, close 
                FROM historical_data 
                WHERE ticker = ${ticker} 
                AND date >= ${startDate.toISOString().split('T')[0]}::date
                AND date <= ${endDate.toISOString().split('T')[0]}::date
                ORDER BY date ASC
            `;
            historyData[ticker] = hist;
        } catch (err) {
            console.error(`[PnL Job] Error fetching history for ${ticker}:`, err);
            historyData[ticker] = [];
        }
    }

    // Get currencies used
    const currencies = await sql`
        SELECT DISTINCT UPPER(currency) as currency FROM transactions 
        WHERE portfolio_id = ${portfolioId} AND currency != 'EUR'
    `;

    // Fetch currency rates
    const currencyData: Record<string, any[]> = {};
    for (const row of currencies) {
        const currency = row.currency;
        if (!currency) continue;
        const pair = `${currency}/EUR`;
        try {
            let hist = await sql`
                SELECT date, close FROM historical_data 
                WHERE ticker = ${pair} 
                AND date >= ${startDate.toISOString().split('T')[0]}::date
                AND date <= ${endDate.toISOString().split('T')[0]}::date
                ORDER BY date ASC
            `;
            if (hist.length === 0) {
                await MarketDataService.syncCurrencyHistory(6);
                hist = await sql`
                    SELECT date, close FROM historical_data 
                    WHERE ticker = ${pair} 
                    AND date >= ${startDate.toISOString().split('T')[0]}::date
                    ORDER BY date ASC
                `;
            }
            currencyData[currency] = hist;
        } catch (err) {
            console.error(`[PnL Job] Error fetching currency ${currency}:`, err);
            currencyData[currency] = [];
        }
    }

    // Helper functions
    const getPriceAtDate = (ticker: string, dateStr: string) => {
        const list = historyData[ticker] || [];
        const exact = list.find(d => new Date(d.date).toISOString().split('T')[0] === dateStr);
        return exact ? Number(exact.close) : 0;
    };

    const getRateAtDate = (curr: string, dateStr: string) => {
        if (curr === 'EUR') return 1.0;
        const list = currencyData[curr] || [];
        const exact = list.find(d => new Date(d.date).toISOString().split('T')[0] === dateStr);
        return exact ? Number(exact.close) : 1.0;
    };

    // Calculate PnL for each date
    for (const dateStr of dates) {
        // Get positions that were open on this date
        const positionsOnDate = await getPositionsOnDate(portfolioId, dateStr);

        if (positionsOnDate.size === 0) continue;

        let dailyPnl = 0;

        for (const [ticker, pos] of positionsOnDate) {
            const price = getPriceAtDate(ticker, dateStr);
            const rate = getRateAtDate(pos.currency, dateStr);

            if (price > 0) {
                const valueEur = pos.qty * price * rate;
                const costEur = pos.qty * pos.avgPrice * rate;
                dailyPnl += (valueEur - costEur);
            }
        }

        // Upsert into cache
        await sql`
            INSERT INTO pnl_history_cache (portfolio_id, date, pnl_eur, calculated_at)
            VALUES (${portfolioId}, ${dateStr}::date, ${dailyPnl}, NOW())
            ON CONFLICT (portfolio_id, date) 
            DO UPDATE SET pnl_eur = ${dailyPnl}, calculated_at = NOW()
        `;
    }

    console.log(`[PnL Job] Portfolio ${portfolioId}: ${dates.length} days processed.`);
}

// Daily update: Last 5 days
export async function calculatePnLDaily(): Promise<void> {
    console.log('[PnL Job] Running DAILY update (last 5 days)...');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 5);

    const portfolios = await sql`SELECT id FROM portfolios`;
    for (const portfolio of portfolios) {
        await calculatePnLForDateRange(portfolio.id, startDate, endDate);
    }

    console.log('[PnL Job] Daily update completed.');
}

// Weekly update: Full 6 months
export async function calculatePnLWeekly(): Promise<void> {
    console.log('[PnL Job] Running WEEKLY update (full 6 months)...');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);

    const portfolios = await sql`SELECT id FROM portfolios`;
    for (const portfolio of portfolios) {
        await calculatePnLForDateRange(portfolio.id, startDate, endDate);
    }

    console.log('[PnL Job] Weekly update completed.');
}

// Schedule the job
export function schedulePnLJob(): void {
    const runAt4AM = () => {
        const now = new Date();
        const madTimeString = now.toLocaleString("en-US", { timeZone: "Europe/Madrid" });
        const madTime = new Date(madTimeString);

        const next4AM = new Date(madTime);
        next4AM.setHours(4, 0, 0, 0);

        if (madTime > next4AM) {
            next4AM.setDate(next4AM.getDate() + 1);
        }

        const msUntil4AM = next4AM.getTime() - madTime.getTime();
        console.log(`[PnL Job] Next run in ${Math.round(msUntil4AM / 1000 / 60)} minutes (at 4:00 AM Madrid)`);

        setTimeout(() => {
            // Check if it's Sunday for weekly run
            const runDate = new Date();
            const dayOfWeek = runDate.getDay(); // 0 = Sunday

            if (dayOfWeek === 0) {
                calculatePnLWeekly();
            } else {
                calculatePnLDaily();
            }

            // Schedule to run every 24 hours
            setInterval(() => {
                const checkDate = new Date();
                if (checkDate.getDay() === 0) {
                    calculatePnLWeekly();
                } else {
                    calculatePnLDaily();
                }
            }, 24 * 60 * 60 * 1000);
        }, msUntil4AM);
    };

    runAt4AM();
}

// For initial population or manual trigger
export async function calculatePnLForAllPortfolios(): Promise<void> {
    console.log('[PnL Job] Manual trigger: Full calculation...');
    await calculatePnLWeekly();
}
