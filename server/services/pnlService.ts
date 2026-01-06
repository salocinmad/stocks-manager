import sql from '../db';
import { MarketDataService } from './marketData';

export interface PositionState {
    ticker: string;
    quantity: number;
    averagePrice: number; // In asset currency
    currency: string;
}

export const PnLService = {
    /**
     * Reconstructs the state of positions on a specific date by replaying all transactions up to that date.
     * Guaranteed to be FIFO/Weighted Average compatible.
     */
    async getPositionsOnDate(portfolioId: string, dateStr: string): Promise<Map<string, PositionState>> {
        const positionsMap = new Map<string, PositionState>();

        // Get all BUY/SELL transactions up to and including this date
        const transactions = await sql`
            SELECT ticker, type, amount, price_per_unit, currency, date, fees
            FROM transactions
            WHERE portfolio_id = ${portfolioId}
            AND date::date <= ${dateStr}::date
            ORDER BY date ASC, created_at ASC
        `;

        for (const tx of transactions) {
            const ticker = (tx.ticker || '').toUpperCase();
            const type = tx.type;
            const amount = Number(tx.amount) || 0;
            const price = Number(tx.price_per_unit) || 0;
            const commission = Number(tx.fees) || 0;
            const currency = (tx.currency || 'EUR').toUpperCase();

            const current = positionsMap.get(ticker) || {
                ticker,
                quantity: 0,
                averagePrice: 0,
                currency
            };

            if (type === 'BUY') {
                // Weighted Average Price Calculation
                // New logic: Include commission in cost basis? 
                // Previous logic did: (Qty * Avg) + (Amt * Price) / NewQty
                // To be exact "Break Even" price: Cost Basis = Value + Fees

                const currentCost = current.quantity * current.averagePrice;
                const newCost = (amount * price) + commission;
                const totalCost = currentCost + newCost;

                const newQty = current.quantity + amount;

                // Avoid division by zero
                if (newQty > 0) {
                    current.averagePrice = totalCost / newQty;
                } else {
                    current.averagePrice = 0;
                }

                current.quantity = newQty;
                current.currency = currency;
            } else if (type === 'SELL') {
                // Selling reduces quantity but DOES NOT change Average Buy Price 
                // (unless we were using LIFO, but standard is FIFO/WeightedAvg for this tracking)
                current.quantity = Math.max(0, current.quantity - amount);
            }

            if (current.quantity > 0.00000001) { // Avoid floating point dust
                positionsMap.set(ticker, current);
            } else {
                positionsMap.delete(ticker);
            }
        }

        return positionsMap;
    },

    /**
     * Calculates the Unrealized PnL for a single day given market data.
     */
    calculateDailyUnrealizedPnL(
        positions: PositionState[],
        marketPrices: Record<string, number>, // Ticker -> Price
        fxRates: Record<string, number>       // Currency -> EUR Rate
    ): number {
        let totalPnLEur = 0;

        for (const pos of positions) {
            const currentPrice = marketPrices[pos.ticker] || 0;
            const rateToEur = fxRates[pos.currency] || (pos.currency === 'EUR' ? 1.0 : 0);

            if (currentPrice > 0 && rateToEur > 0) {
                const marketValueEur = pos.quantity * currentPrice * rateToEur;
                const costBasisEur = pos.quantity * pos.averagePrice * rateToEur;

                totalPnLEur += (marketValueEur - costBasisEur);
            }
        }

        return Number(totalPnLEur.toFixed(2)); // Round to 2 decimals for absolute precision in display
    },

    /**
     * Calculates Realized PnL using strict FIFO (First-In, First-Out) matching.
     * Essential for Tax Reporting.
     */
    async calculateRealizedPnL_FIFO(portfolioId: string): Promise<any[]> {
        // Get all valid transactions sorted by date
        const transactions = await sql`
            SELECT id, ticker, type, amount, price_per_unit, currency, date, fees, exchange_rate_to_eur
            FROM transactions
            WHERE portfolio_id = ${portfolioId}
            ORDER BY date ASC, created_at ASC
        `;

        const realizedOperations: any[] = [];
        // Map to track open lots for each ticker: Ticker -> Array of { quantity, price, date, currency, costInEur }
        const openLots = new Map<string, any[]>();

        for (const tx of transactions) {
            const ticker = (tx.ticker || '').toUpperCase();
            const type = tx.type; // 'BUY' or 'SELL'
            const amount = Number(tx.amount);
            const price = Number(tx.price_per_unit);
            const fees = Number(tx.fees) || 0;
            const rate = Number(tx.exchange_rate_to_eur) || 1.0;

            // Normalize everything to base currency (EUR) for tax purposes if needed, 
            // but usually you match in original currency then convert PnL.
            // Let's stick to standard practice: Match lots, calculate Gain in base currency.

            if (!openLots.has(ticker)) {
                openLots.set(ticker, []);
            }
            const lots = openLots.get(ticker)!;

            if (type === 'BUY') {
                // Add new lot
                // Cost Basis includes fees for BUYs
                const totalCostEur = ((amount * price) + fees) * rate; // Rough approximation for total basis in EUR
                const unitCostBase = (price + (fees / amount)); // effective unit price in asset currency

                lots.push({
                    date: tx.date,
                    quantity: amount,
                    unitPrice: unitCostBase, // Basis per share
                    currency: tx.currency,
                    rateToEur: rate,
                    originalFees: fees
                });
            }
            else if (type === 'SELL') {
                let remainingToSell = amount;
                let usageFees = fees; // We distribute sell fees proportionally or just subtract from total PnL

                // Realized PnL for this specific SELL transaction
                // We might match against multiple BUY lots

                while (remainingToSell > 0.00000001 && lots.length > 0) {
                    const matchLot = lots[0]; // First In

                    const quantityMatched = Math.min(remainingToSell, matchLot.quantity);

                    // Logic:
                    // Sell Proceeds = (Qty * SellPrice) - (Pro-rated Sell Fees)
                    // Cost Basis = (Qty * BuyPriceWithBuyFees)

                    // Pro-rate sell fees for this chunk
                    const portion = quantityMatched / amount;
                    const sellFeesForChunk = usageFees * portion;

                    // Proceeds in EUR
                    const proceedsEur = ((quantityMatched * price) * rate) - (sellFeesForChunk * rate);

                    // Cost in EUR (using historical rate of the BUY)
                    // If we want accurate "Multi-Currency" tax handling, we typically compare Cost(HistoricalEUR) vs Proceeds(CurrentEUR).
                    const costEur = (quantityMatched * matchLot.unitPrice) * matchLot.rateToEur;

                    const gainEur = proceedsEur - costEur;

                    realizedOperations.push({
                        ticker,
                        sellDate: tx.date,
                        buyDate: matchLot.date,
                        quantity: quantityMatched,
                        buyPriceEur: (matchLot.unitPrice * matchLot.rateToEur).toFixed(4),
                        sellPriceEur: (price * rate).toFixed(4),
                        buyPriceOrig: matchLot.unitPrice,
                        sellPriceOrig: price,
                        buyRate: matchLot.rateToEur,
                        sellRate: rate,
                        gainEur: Number(gainEur.toFixed(2)),
                        currency: tx.currency
                    });

                    // Update Lot
                    matchLot.quantity -= quantityMatched;
                    remainingToSell -= quantityMatched;

                    if (matchLot.quantity < 0.00000001) {
                        lots.shift(); // Remove empty lot
                    }
                }
            }
        }

        return realizedOperations;
    }
};
