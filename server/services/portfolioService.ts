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
        // Wrap everything in a Transaction Block
        await sql.begin(async (tx) => {
            // 1. Record Transaction (Use 'tx' instead of 'sql')
            await tx`
                INSERT INTO transactions (portfolio_id, ticker, type, amount, price_per_unit, currency, exchange_rate_to_eur, fees)
                VALUES (${portfolioId}, ${ticker}, ${type}, ${amount}, ${price}, ${currency}, ${exchangeRate}, ${commission})
            `;

            // 2. Update Position
            const [existing] = await tx`SELECT * FROM positions WHERE portfolio_id = ${portfolioId} AND ticker = ${ticker} FOR UPDATE`;
            // Added FOR UPDATE to lock the row and prevent race conditions

            if (!existing) {
                if (type === 'SELL') throw new Error('Cannot sell asset you do not own');

                // Initial Buy
                await tx`
                    INSERT INTO positions (portfolio_id, ticker, asset_type, quantity, average_buy_price, commission, currency)
                    VALUES (${portfolioId}, ${ticker}, 'STOCK', ${amount}, ${price}, ${commission}, ${currency})
                `;
            } else {
                let newQty = Number(existing.quantity);
                let newAvg = Number(existing.average_buy_price);
                let newCommission = Number(existing.commission || 0);

                if (type === 'BUY') {
                    const currentCost = newQty * newAvg;
                    const newCost = Number(amount) * Number(price);
                    const totalCost = currentCost + newCost;

                    newQty += Number(amount);
                    newAvg = totalCost / newQty;
                    newCommission += Number(commission);
                } else {
                    // SELL
                    newQty -= Number(amount);
                    if (newQty < 0) throw new Error('Insufficient balance');
                }

                if (newQty === 0) {
                    await tx`DELETE FROM positions WHERE id = ${existing.id}`;
                } else {
                    await tx`
                        UPDATE positions 
                        SET quantity = ${newQty}, average_buy_price = ${newAvg}, commission = ${newCommission}, updated_at = NOW()
                        WHERE id = ${existing.id}
                    `;
                }
            }
        }); // End of Transaction (Commit happens automatically here. Rollback on Error.)
    }
};
