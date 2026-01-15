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
     * Uses separate rates for cost basis (position currency) and market value (price currency)
     * to match Dashboard calculation logic.
     */
    calculateDailyUnrealizedPnL(
        positions: PositionState[],
        marketPrices: Record<string, number>,     // Ticker -> Price
        positionRates: Record<string, number>,    // Currency -> EUR Rate (for cost basis)
        priceRates?: Record<string, number>       // Ticker -> EUR Rate (for market value, optional)
    ): number {
        let totalPnLEur = 0;

        for (const pos of positions) {
            const currentPrice = marketPrices[pos.ticker] || 0;
            const posRate = positionRates[pos.currency] || (pos.currency === 'EUR' ? 1.0 : 0);
            // If priceRates provided, use it; otherwise fall back to position rate
            const priceRate = priceRates?.[pos.ticker] ?? posRate;

            if (currentPrice > 0 && posRate > 0 && priceRate > 0) {
                const marketValueEur = pos.quantity * currentPrice * priceRate;
                const costBasisEur = pos.quantity * pos.averagePrice * posRate;

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

            if (!openLots.has(ticker)) {
                openLots.set(ticker, []);
            }
            const lots = openLots.get(ticker)!;

            if (type === 'BUY') {
                // Add new lot
                // Track commission SEPARATELY to be precise
                lots.push({
                    date: tx.date,
                    quantity: amount,
                    unitPrice: price, // Pure price
                    currency: tx.currency,
                    rateToEur: rate,
                    originalFees: fees,
                    initialQuantity: amount // Needed to calculate proportional fee per share
                });
            }
            else if (type === 'SELL') {
                let remainingToSell = amount;

                // Realized PnL for this specific SELL transaction
                while (remainingToSell > 0.00000001 && lots.length > 0) {
                    const matchLot = lots[0]; // First In

                    const quantityMatched = Math.min(remainingToSell, matchLot.quantity);

                    // 1. Calculate Proportional Buy Commission for this chunk
                    // (Quantity Matched / Initial Lot Quantity) * Original Lot Fees
                    const buyFeesAllocated = (quantityMatched / matchLot.initialQuantity) * matchLot.originalFees;

                    // 2. Calculate Proportional Sell Commission for this chunk
                    // (Quantity Matched / Total Sell Quantity) * Total Sell Fees
                    const sellFeesAllocated = (quantityMatched / amount) * fees;

                    // 3. Proceeds in EUR (Current Rate)
                    // Pure Sale amount - Allocated Sell Fees
                    const sellValueEur = (quantityMatched * price * rate);
                    const sellFeesEur = sellFeesAllocated * rate;
                    const netProceedsEur = sellValueEur - sellFeesEur;

                    // 4. Cost in EUR (Historical Rate)
                    // Pure Buy amount + Allocated Buy Fees
                    const buyValueEur = (quantityMatched * matchLot.unitPrice * matchLot.rateToEur);
                    const buyFeesEur = buyFeesAllocated * matchLot.rateToEur;
                    const totalCostEur = buyValueEur + buyFeesEur;

                    const gainEur = netProceedsEur - totalCostEur;

                    realizedOperations.push({
                        ticker,
                        sellDate: tx.date,
                        buyDate: matchLot.date,
                        quantity: quantityMatched,
                        buyPriceEur: Number(totalCostEur.toFixed(4)), // Cost Basis (Value + Fees)
                        sellPriceEur: Number(netProceedsEur.toFixed(4)), // Net Proceeds (Value - Fees)
                        buyPriceOrig: matchLot.unitPrice,
                        sellPriceOrig: price,
                        buyFeesEur: Number(buyFeesEur.toFixed(4)),
                        sellFeesEur: Number(sellFeesEur.toFixed(4)),
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
