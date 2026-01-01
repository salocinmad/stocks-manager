import sql from '../db';

export const PortfolioService = {
    /**
     * Add a transaction (BUY/SELL) and update the position accordingly.
     * Handles weighted average price calculation for BUYs and quantity reduction for SELLs.
     */
    async addTransaction(
        portfolioId: string,
        ticker: string,
        type: 'BUY' | 'SELL',
        amount: number,
        price: number,
        currency: string,
        commission: number = 0,
        exchangeRate: number = 1.0
    ) {
        // 1. Record Transaction
        await sql`
            INSERT INTO transactions (portfolio_id, ticker, type, amount, price_per_unit, currency, exchange_rate_to_eur, fees)
            VALUES (${portfolioId}, ${ticker}, ${type}, ${amount}, ${price}, ${currency}, ${exchangeRate}, ${commission})
        `;

        // 2. Update Position
        const [existing] = await sql`SELECT * FROM positions WHERE portfolio_id = ${portfolioId} AND ticker = ${ticker}`;

        if (!existing) {
            if (type === 'SELL') throw new Error('Cannot sell asset you do not own');

            // Initial Buy: Use RAW price (commission is separate)
            // Note: Before the 'commission' column existed, we stored Effective Price ((Qty*Price + Comm)/Qty).
            // Now we store Raw Price and Commission separately.

            await sql`
                INSERT INTO positions (portfolio_id, ticker, asset_type, quantity, average_buy_price, commission, currency)
                VALUES (${portfolioId}, ${ticker}, 'STOCK', ${amount}, ${price}, ${commission}, ${currency})
            `;
        } else {
            let newQty = Number(existing.quantity);
            let newAvg = Number(existing.average_buy_price);
            let newCommission = Number(existing.commission || 0);

            if (type === 'BUY') {
                // Weighted Average Calculation (RAW Prices)
                // Treat existing.average_buy_price as current unit cost (Raw or Effective-from-old-data).
                // If existing is Old Data (Comm=0), it's Total Effective Cost. 
                // Since Comm=0, adding NewComm works out to preserve Total Cost Basis correctly.
                const currentCost = newQty * newAvg;
                const newCost = Number(amount) * Number(price); // Raw cost of new batch (Excludes comm)

                const totalCost = currentCost + newCost;

                newQty += Number(amount);
                newAvg = totalCost / newQty;

                newCommission += Number(commission);
            } else {
                // SELL: Reduce quantity
                // FIFO/Weighted Average Rules: Average Unit Price DOES NOT change on Sell.
                newQty -= Number(amount);

                // For sells, do NOT add commission to Cost Basis of remaining shares.
                // Commission is only tracked in Transactions for realized PnL analysis.

                if (newQty < 0) throw new Error('Insufficient balance');
            }

            if (newQty === 0) {
                await sql`DELETE FROM positions WHERE id = ${existing.id}`;
            } else {
                await sql`
                    UPDATE positions 
                    SET quantity = ${newQty}, average_buy_price = ${newAvg}, commission = ${newCommission}, updated_at = NOW()
                    WHERE id = ${existing.id}
                `;
            }
        }
    }
};
