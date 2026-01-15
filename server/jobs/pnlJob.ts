/**
 * PnL Pre-calculation Job
 * - Daily at 4:00 AM: Calculate last 5 days
 * - Weekly (Sunday) at 4:00 AM: Calculate full 6 months
 * 
 * Uses transactions history to determine which positions were open on each day.
 */

import sql from '../db';
import { MarketDataService } from '../services/marketData';
import { PnLService } from '../services/pnlService';
import { log } from '../utils/logger';

// Calculate PnL for a specific date range (uses only trading days)
async function calculatePnLForDateRange(portfolioId: string, startDate: Date, endDate: Date): Promise<void> {
    log.verbose('[PnL Job]', `Portfolio ${portfolioId}: ${startDate.toISOString().split('T')[0]} → ${endDate.toISOString().split('T')[0]}`);

    // Get all tickers from transactions for this portfolio FIRST
    const allTickers = await sql`
        SELECT DISTINCT UPPER(ticker) as ticker FROM transactions WHERE portfolio_id = ${portfolioId}
    `;
    const tickers = allTickers.map((t: any) => t.ticker).filter(Boolean);

    if (tickers.length === 0) {
        log.debug('[PnL Job]', `Portfolio ${portfolioId} has no transactions, skipping.`);
        return;
    }

    // Get ONLY trading days (dates that exist in historical_data for ANY of the tickers)
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
        log.debug('[PnL Job]', `Portfolio ${portfolioId} has no trading days in range, skipping.`);
        return;
    }

    log.debug('[PnL Job]', `Portfolio ${portfolioId}: found ${dates.length} trading days`);

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
            log.error('[PnL Job]', `Error fetching history for ${ticker}:`, err);
            historyData[ticker] = [];
        }
    }

    // Get currencies used
    const currencies = await sql`
        SELECT DISTINCT UPPER(currency) as currency FROM transactions 
        WHERE portfolio_id = ${portfolioId} AND currency != 'EUR'
    `;

    // Fetch currency rates
    // NOTE: GBX (pence) requires special handling - Yahoo only provides GBP/EUR rates
    const currencyData: Record<string, any[]> = {};
    const currenciesToFetch = new Set<string>();

    for (const row of currencies) {
        const currency = row.currency;
        if (!currency) continue;
        // Map GBX to GBP for rate lookup (GBX rates don't exist in Yahoo)
        const lookupCurrency = currency === 'GBX' ? 'GBP' : currency;
        currenciesToFetch.add(lookupCurrency);
    }

    for (const lookupCurrency of currenciesToFetch) {
        const pair = `${lookupCurrency}/EUR`;
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
            currencyData[lookupCurrency] = hist;
        } catch (err) {
            log.error('[PnL Job]', `Error fetching currency ${lookupCurrency}:`, err);
            currencyData[lookupCurrency] = [];
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

        // Handle GBX (pence) -> lookup GBP rate and apply 0.01 multiplier
        let lookupCurrency = curr;
        let multiplier = 1.0;
        if (curr === 'GBX') {
            lookupCurrency = 'GBP';
            multiplier = 0.01;  // 100 pence = 1 pound
        }

        const list = currencyData[lookupCurrency] || [];
        const exact = list.find(d => new Date(d.date).toISOString().split('T')[0] === dateStr);
        return exact ? Number(exact.close) * multiplier : (multiplier === 0.01 ? 0.01 : 1.0);
    };

    // Calculate PnL for each date
    for (const dateStr of dates) {
        const positionsMap = await PnLService.getPositionsOnDate(portfolioId, dateStr);
        const positions = Array.from(positionsMap.values());

        if (positions.length === 0) continue;

        const prices: Record<string, number> = {};
        const positionRates: Record<string, number> = { 'EUR': 1.0 };
        const priceRates: Record<string, number> = {};

        for (const pos of positions) {
            prices[pos.ticker] = getPriceAtDate(pos.ticker, dateStr);
            positionRates[pos.currency] = getRateAtDate(pos.currency, dateStr);
            // For historical prices, assume same currency as position
            // (historical_data doesn't store currency info)
            priceRates[pos.ticker] = getRateAtDate(pos.currency, dateStr);
        }

        const dailyPnl = PnLService.calculateDailyUnrealizedPnL(positions, prices, positionRates, priceRates);

        // Store aggregate PnL
        await sql`
            INSERT INTO pnl_history_cache (portfolio_id, date, pnl_eur, calculated_at)
            VALUES (${portfolioId}, ${dateStr}::date, ${dailyPnl}, NOW())
            ON CONFLICT (portfolio_id, date) 
            DO UPDATE SET pnl_eur = ${dailyPnl}, calculated_at = NOW()
        `;

        // Store detailed breakdown per position
        // First delete old details for this date
        await sql`DELETE FROM pnl_history_detail WHERE portfolio_id = ${portfolioId} AND date = ${dateStr}::date`;

        // Insert new details
        for (const pos of positions) {
            const marketPrice = prices[pos.ticker] || 0;
            const posRate = positionRates[pos.currency] || 1.0;
            const priceRate = priceRates[pos.ticker] || posRate;

            if (marketPrice > 0 && posRate > 0 && priceRate > 0) {
                const costEur = pos.quantity * pos.averagePrice * posRate;
                const valueEur = pos.quantity * marketPrice * priceRate;
                const pnlEur = valueEur - costEur;

                await sql`
                    INSERT INTO pnl_history_detail (
                        portfolio_id, date, ticker, quantity, avg_price, market_price,
                        position_currency, price_currency, position_rate_eur, price_rate_eur,
                        cost_eur, value_eur, pnl_eur, calculated_at
                    ) VALUES (
                        ${portfolioId}, ${dateStr}::date, ${pos.ticker}, ${pos.quantity}, ${pos.averagePrice}, ${marketPrice},
                        ${pos.currency}, ${pos.currency}, ${posRate}, ${priceRate},
                        ${costEur.toFixed(4)}, ${valueEur.toFixed(4)}, ${pnlEur.toFixed(4)}, NOW()
                    )
                `;
            }
        }
    }

    log.verbose('[PnL Job]', `Portfolio ${portfolioId}: ${dates.length} days processed.`);
}

// Daily update: Last 5 days
export async function calculatePnLDaily(): Promise<void> {
    log.info('[PnL Job]', 'Running DAILY update (last 5 days)...');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 5);

    const portfolios = await sql`SELECT id FROM portfolios`;
    for (const portfolio of portfolios) {
        await calculatePnLForDateRange(portfolio.id, startDate, endDate);
    }

    log.summary('[PnL Job]', `✅ Daily update completed (${portfolios.length} portfolios)`);
}

// Weekly update: Full 6 months
export async function calculatePnLWeekly(): Promise<void> {
    log.info('[PnL Job]', 'Running WEEKLY update (full 6 months)...');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);

    const portfolios = await sql`SELECT id FROM portfolios`;
    for (const portfolio of portfolios) {
        await calculatePnLForDateRange(portfolio.id, startDate, endDate);
    }

    log.summary('[PnL Job]', `✅ Weekly update completed (${portfolios.length} portfolios)`);
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
        log.info('[PnL Job]', `Next run in ${Math.round(msUntil4AM / 1000 / 60)} minutes (at 4:00 AM Madrid)`);

        setTimeout(() => {
            const runDate = new Date();
            const dayOfWeek = runDate.getDay();

            if (dayOfWeek === 0) {
                calculatePnLWeekly();
            } else {
                calculatePnLDaily();
            }

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
    log.info('[PnL Job]', 'Manual trigger: Full calculation...');
    await calculatePnLWeekly();
}

// For admin-triggered FULL recalculation (from first transaction date)
export async function recalculateAllHistory(): Promise<void> {
    log.info('[PnL Job]', 'Recalculating FULL PnL history for ALL portfolios...');

    const portfolios = await sql`SELECT id FROM portfolios`;
    const endDate = new Date();

    for (const portfolio of portfolios) {
        const firstTx = await sql`
            SELECT MIN(date) as first_date FROM transactions WHERE portfolio_id = ${portfolio.id}
        `;

        let startDate: Date;
        if (firstTx[0]?.first_date) {
            startDate = new Date(firstTx[0].first_date);
        } else {
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            startDate = sixMonthsAgo;
        }

        await calculatePnLForDateRange(portfolio.id, startDate, endDate);
    }

    log.summary('[PnL Job]', `✅ Full history recalculation completed (${portfolios.length} portfolios)`);
}
