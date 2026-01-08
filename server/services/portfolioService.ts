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
    },



    /**
     * Pure function to calculate the current FIFO queue from a list of transactions.
     */
    calculateFIFOQueue(transactions: any[]) {
        interface Lot {
            date: Date;
            price: number;
            remainingQty: number;
            initialQty: number;
            remainingComm: number;
            currency: string;
        }

        let lots: Lot[] = [];
        let currentCurrency = 'EUR';

        for (const t of transactions) {
            const type = t.type;
            const amount = Number(t.amount);
            const price = Number(t.price_per_unit);
            const fees = Number(t.fees || 0);
            const currency = t.currency;

            if (type === 'BUY' || type === 'DEPOSIT') {
                if (lots.length === 0) currentCurrency = currency;
                lots.push({
                    date: new Date(t.date),
                    price: price,
                    remainingQty: amount,
                    initialQty: amount,
                    remainingComm: fees,
                    currency: currency
                });
            }
            else if (type === 'SELL' || type === 'WITHDRAWAL') {
                let qtyToSell = amount;
                while (qtyToSell > 0 && lots.length > 0) {
                    const oldestLot = lots[0];
                    if (oldestLot.remainingQty > qtyToSell) {
                        const commUsed = (qtyToSell / oldestLot.remainingQty) * oldestLot.remainingComm; // Approximation for historical
                        // NOTE: For historical replay, we just reduce. For simulation, we need exact cost.
                        // Better formula: (qtyToSell / current_remaining_qty) * current_remaining_comm
                        oldestLot.remainingQty -= qtyToSell;
                        oldestLot.remainingComm -= commUsed;
                        qtyToSell = 0;
                    } else {
                        qtyToSell -= oldestLot.remainingQty;
                        lots.shift();
                    }
                }
            }
        }
        return { lots, currentCurrency };
    },

    /**
     * Simulate a Sell operation to calculate Cost Basis (FIFO) without modifying DB.
     */
    async simulateSell(portfolioId: string, ticker: string, sellAmount: number) {
        const transactions = await sql`
            SELECT * FROM transactions 
            WHERE portfolio_id = ${portfolioId} AND ticker = ${ticker}
            ORDER BY date ASC, created_at ASC
        `;

        // 1. Get current state
        const { lots } = this.calculateFIFOQueue(transactions);

        // 2. Simulate the Sell
        let qtyToSell = sellAmount;
        let totalCostBasis = 0; // The original cost of the shares we are selling

        // Deep copy lots to not mutate if we were using a persisted state (here it's fresh)
        const simLots = JSON.parse(JSON.stringify(lots));

        if (simLots.length === 0) return { costBasis: 0, currency: 'EUR', error: 'No position' };

        // Check if enough qty
        const totalQty = simLots.reduce((acc: number, l: any) => acc + l.remainingQty, 0);
        if (sellAmount > totalQty) return { costBasis: 0, currency: simLots[0]?.currency, error: 'Insufficient balance' };

        while (qtyToSell > 0 && simLots.length > 0) {
            const lot = simLots[0];
            const taking = Math.min(lot.remainingQty, qtyToSell);

            // Cost of these specific shares: (Price * Qty) + Pro-rated Original Commission
            const proportion = taking / lot.remainingQty;
            const commPart = lot.remainingComm * proportion;

            totalCostBasis += (lot.price * taking) + commPart;

            lot.remainingQty -= taking;
            qtyToSell -= taking;

            if (lot.remainingQty <= 0.0000001) simLots.shift();
        }

        return {
            costBasis: totalCostBasis,
            currency: simLots[0]?.currency || 'EUR'
        };
    },

    /**
     * Recalculate a position from scratch using the full transaction history.
     */
    async recalculatePositionFromHistory(portfolioId: string, ticker: string) {
        // Run completely inside a transaction to ensure integrity
        await sql.begin(async (tx) => {
            // 1. Fetch all transactions
            const transactions = await tx`
                SELECT * FROM transactions 
                WHERE portfolio_id = ${portfolioId} AND ticker = ${ticker}
                ORDER BY date ASC, created_at ASC
            `;

            // 2. Strict FIFO Replay
            const { lots, currentCurrency } = PortfolioService.calculateFIFOQueue(transactions);

            // 3. Aggregate Final Position
            let totalQty = 0;
            let totalCostBase = 0;
            let totalAliveCommission = 0;

            for (const lot of lots) {
                totalQty += lot.remainingQty;
                totalCostBase += (lot.remainingQty * lot.price);
                totalAliveCommission += lot.remainingComm;
            }

            // 4. Update or Delete
            if (totalQty > 0.000001) {
                const avgPrice = totalCostBase / totalQty;
                await tx`
                    INSERT INTO positions (portfolio_id, ticker, quantity, average_buy_price, commission, currency, updated_at)
                    VALUES (${portfolioId}, ${ticker}, ${totalQty}, ${avgPrice}, ${totalAliveCommission}, ${currentCurrency}, NOW())
                    ON CONFLICT (portfolio_id, ticker) DO UPDATE SET
                        quantity = EXCLUDED.quantity,
                        average_buy_price = EXCLUDED.average_buy_price,
                        commission = EXCLUDED.commission,
                        currency = EXCLUDED.currency,
                        updated_at = NOW()
                `;
            } else {
                await tx`DELETE FROM positions WHERE portfolio_id = ${portfolioId} AND ticker = ${ticker}`;
            }
        });
    },

    /**
     * Update a specific transaction and trigger recalculation.
     */
    async updateTransaction(
        transactionId: string,
        portfolioId: string,
        updates: {
            date?: string;
            amount?: number;
            price?: number;
            fees?: number;
            currency?: string;
            exchange_rate?: number;
        }
    ) {
        // 1. Update Transaction
        const updated = await sql`
            UPDATE transactions 
            SET 
                date = COALESCE(${updates.date}::timestamp, date),
                amount = COALESCE(${updates.amount}, amount),
                price_per_unit = COALESCE(${updates.price}, price_per_unit),
                fees = COALESCE(${updates.fees}, fees),
                currency = COALESCE(${updates.currency}, currency),
                exchange_rate_to_eur = COALESCE(${updates.exchange_rate}, exchange_rate_to_eur)
            WHERE id = ${transactionId} AND portfolio_id = ${portfolioId}
            RETURNING ticker
        `;

        if (updated.length === 0) {
            throw new Error('Transaction not found or access denied');
        }

        const ticker = updated[0].ticker;

        // 2. Trigger Recalculation
        await this.recalculatePositionFromHistory(portfolioId, ticker);

        return true;
    }
};
