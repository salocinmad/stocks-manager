import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import sql from '../db';
import { MarketDataService } from '../services/marketData';

export const portfolioRoutes = new Elysia({ prefix: '/portfolios' })
    .use(
        jwt({
            name: 'jwt',
            secret: process.env.JWT_SECRET || 'changeme_in_prod',
            exp: '2h'
        })
    )
    .derive(async ({ jwt, headers, set }) => {
        const auth = headers['authorization'];
        if (!auth?.startsWith('Bearer ')) {
            set.status = 401;
            throw new Error('Unauthorized: No token provided');
        }
        const token = auth.slice(7);
        const profile = await jwt.verify(token) as { sub?: string; email?: string } | false;

        if (!profile || !profile.sub) {
            console.error('JWT Verification failed:', { profile });
            set.status = 401;
            throw new Error('Unauthorized: Invalid token');
        }

        console.log('Authenticated user:', profile.sub);
        return { userId: profile.sub as string };
    })
    // List Portfolios
    // List Portfolios
    .get('/', async ({ userId }) => {
        try {
            console.log(`Fetching portfolios for user ${userId}`);
            const portfolios = await sql`
                SELECT id, name, is_public, is_favorite, created_at, 
                (SELECT COUNT(*) FROM positions WHERE portfolio_id = portfolios.id) as positions_count
                FROM portfolios 
                WHERE user_id = ${userId}
                ORDER BY is_favorite DESC, created_at ASC
            `;
            console.log(`Found ${portfolios.length} portfolios for user ${userId}`);
            // Force plain array conversion to avoid serialization issues
            return [...portfolios].map(p => ({
                id: p.id,
                name: p.name,
                is_public: p.is_public,
                is_favorite: Boolean(p.is_favorite),
                created_at: p.created_at,
                positions_count: Number(p.positions_count)
            }));
        } catch (error) {
            console.error('Error fetching portfolios:', error);
            return []; // Retorna array vacío en error para no romper frontend
        }
    })
    // Get Consolidated Summary for Dashboard
    .get('/summary', async ({ userId, query }) => {
        try {
            // @ts-ignore
            const { portfolioId } = query;

            let positions;

            // 1. Obtener posiciones (filtradas o todas)
            if (portfolioId && portfolioId !== 'all') {
                positions = await sql`
                    SELECT p.*, port.name as portfolio_name 
                    FROM positions p
                    JOIN portfolios port ON p.portfolio_id = port.id
                    WHERE port.user_id = ${userId} AND port.id = ${portfolioId}
                `;
            } else {
                positions = await sql`
                    SELECT p.*, port.name as portfolio_name 
                    FROM positions p
                    JOIN portfolios port ON p.portfolio_id = port.id
                    WHERE port.user_id = ${userId}
                `;
            }

            if (!positions || positions.length === 0) {
                return {
                    totalValueEur: 0,
                    dailyChangeEur: 0,
                    dailyChangePercent: 0,
                    distribution: []
                };
            }

            // 2. Obtener tickers únicos para consultar precios
            const tickers = [...new Set(positions.map(p => p.ticker))];
            const quotes: Record<string, any> = {};

            await Promise.all(tickers.map(async (ticker) => {
                quotes[ticker] = await MarketDataService.getQuote(ticker);
            }));

            // 3. Obtener tipos de cambio necesarios a EUR
            const currencies = [...new Set(positions.map(p => p.currency))];
            const rates: Record<string, number> = { 'EUR': 1.0 };

            await Promise.all(currencies.map(async (curr) => {
                if (curr !== 'EUR') {
                    const rate = await MarketDataService.getExchangeRate(curr, 'EUR');
                    rates[curr] = rate || 1.0;
                }
            }));

            // 4. Calcular métricas consolidadas
            let totalValueEur = 0;
            let totalPrevValueEur = 0;
            let totalCostEur = 0;
            const distMap: Record<string, number> = {};

            positions.forEach(p => {
                const quote = quotes[p.ticker];
                const rate = rates[p.currency || 'EUR'] || 1.0;
                const qty = Number(p.quantity);
                const avgPrice = Number(p.average_buy_price) || 0;

                // Costo total en EUR
                const costEur = qty * avgPrice * rate;
                totalCostEur += costEur;

                if (quote && quote.c) {
                    const currentValEur = qty * quote.c * rate;
                    const prevValEur = qty * (quote.pc || quote.c) * rate;

                    totalValueEur += currentValEur;
                    totalPrevValueEur += prevValEur;

                    // Distribución
                    const type = p.asset_type || 'STOCK';
                    distMap[type] = (distMap[type] || 0) + currentValEur;
                } else {
                    // Fallback a precio medio si no hay quote
                    const val = qty * avgPrice * rate;
                    totalValueEur += val;
                    totalPrevValueEur += val; // Sin cambio si no hay datos

                    const type = p.asset_type || 'STOCK';
                    distMap[type] = (distMap[type] || 0) + val;
                }
            });

            const dailyChangeEur = totalValueEur - totalPrevValueEur;
            const dailyChangePercent = totalPrevValueEur > 0 ? (dailyChangeEur / totalPrevValueEur) * 100 : 0;

            const totalGainEur = totalValueEur - totalCostEur;
            const totalGainPercent = totalCostEur > 0 ? (totalGainEur / totalCostEur) * 100 : 0;

            const distribution = Object.entries(distMap).map(([name, value]) => ({
                name: name === 'STOCK' ? 'Acciones' : name === 'CRYPTO' ? 'Cripto' : name === 'CASH' ? 'Efectivo' : name,
                value,
                color: name === 'STOCK' ? '#fce903' : name === 'CRYPTO' ? '#94a3b8' : '#3b82f6'
            })).filter(d => d.value > 0);

            return {
                totalValueEur,
                dailyChangeEur,
                dailyChangePercent,
                totalGainEur,
                totalGainPercent,
                distribution
            };

        } catch (error) {
            console.error('Error in /summary:', error);
            return { error: 'Failed to calculate summary' };
        }
    })
    // Create Portfolio
    .post('/', async ({ userId, body, set }) => {
        // @ts-ignore
        const { name } = body;

        // 1. Check limit
        const existing = await sql`SELECT count(*) as count FROM portfolios WHERE user_id = ${userId}`;
        const count = Number(existing[0].count);

        if (count >= 5) {
            set.status = 400;
            return { error: 'Maximum limit of 5 portfolios reached. Cannot create more.' };
        }

        // 2. Create
        try {
            const [portfolio] = await sql`
                INSERT INTO portfolios (user_id, name)
                VALUES (${userId}, ${name || 'Nuevo Portafolio'})
                RETURNING *
            `;
            return portfolio;
        } catch (error) {
            console.error('Error creating portfolio:', error);
            set.status = 500;
            return { error: 'Failed to create portfolio' };
        }
    }, {
        body: t.Object({
            name: t.String()
        })
    })
    // Set Portfolio as Favorite
    .patch('/:id/favorite', async ({ userId, params }) => {
        const { id } = params;

        await sql.begin(async sql => {
            // 1. Unset any other favorites
            await sql`UPDATE portfolios SET is_favorite = false WHERE user_id = ${userId}`;
            // 2. Set this one as favorite
            await sql`UPDATE portfolios SET is_favorite = true WHERE id = ${id} AND user_id = ${userId}`;
        });

        return { success: true };
    })
    // Delete Portfolio (Positions should cascade delete by DB schema)
    .delete('/:id', async ({ userId, params, set }) => {
        const { id } = params;

        // Verify it's not the only portfolio
        const remaining = await sql`SELECT count(*) as count FROM portfolios WHERE user_id = ${userId}`;
        if (Number(remaining[0].count) <= 1) {
            set.status = 400;
            return { error: 'At least one portfolio must remain.' };
        }

        const [deleted] = await sql`
            DELETE FROM portfolios 
            WHERE id = ${id} AND user_id = ${userId}
            RETURNING *
        `;

        if (!deleted) {
            set.status = 404;
            return { error: 'Portfolio not found' };
        }

        // If we deleted the favorite, mark another one
        if (deleted.is_favorite) {
            await sql`
                UPDATE portfolios 
                SET is_favorite = true 
                WHERE id IN (
                    SELECT id FROM portfolios WHERE user_id = ${userId} ORDER BY created_at ASC LIMIT 1
                )
            `;
        }

        return { success: true };
    })
    // Get Portfolio Details with Positions
    .get('/:id', async ({ userId, params }) => {
        const { id } = params;

        // Verify ownership
        const [portfolio] = await sql`
        SELECT * FROM portfolios 
        WHERE id = ${id} AND user_id = ${userId}
    `;

        if (!portfolio) throw new Error('Not found');

        const positions = await sql`
        SELECT * FROM positions WHERE portfolio_id = ${id}
    `;

        // Force plain object return
        return {
            ...portfolio,
            positions: [...positions].map(p => ({ ...p, quantity: Number(p.quantity), average_buy_price: Number(p.average_buy_price) }))
        };
    })
    // Add/Update Position (Simplified logic: Upsert)
    .post('/:id/positions', async ({ userId, params, body }) => {
        const { id } = params;
        console.log('POST /:id/positions - params:', params);
        console.log('POST /:id/positions - userId:', userId);
        console.log('POST /:id/positions - body:', body);

        if (!id || id === 'undefined' || id === 'null') {
            console.error('Invalid portfolio ID:', id);
            throw new Error('Invalid portfolio ID');
        }

        // @ts-ignore
        const { ticker, amount, price, commission = 0, type, currency, exchangeRateToEur } = body;

        // Verify ownership
        const [portfolio] = await sql`SELECT id FROM portfolios WHERE id = ${id} AND user_id = ${userId}`;
        if (!portfolio) {
            console.error('Portfolio not found for id:', id, 'userId:', userId);
            throw new Error('Portfolio not found');
        }

        const exchangeRate = exchangeRateToEur || 1.0;

        // 1. Record Transaction (con tipo de cambio y comisión)
        await sql`
        INSERT INTO transactions (portfolio_id, ticker, type, amount, price_per_unit, currency, exchange_rate_to_eur, fees)
        VALUES (${id}, ${ticker}, ${type}, ${amount}, ${price}, ${currency}, ${exchangeRate}, ${commission})
    `;

        // 2. Update Position
        // Incluir comisión en el cálculo del precio medio efectivo
        const [existing] = await sql`SELECT * FROM positions WHERE portfolio_id = ${id} AND ticker = ${ticker}`;

        if (!existing) {
            if (type === 'SELL') throw new Error('Cannot sell asset you do not own');
            // Para compra inicial: precio efectivo = (cantidad * precio + comisión) / cantidad
            const effectivePrice = (Number(amount) * Number(price) + Number(commission)) / Number(amount);
            await sql`
            INSERT INTO positions (portfolio_id, ticker, asset_type, quantity, average_buy_price, currency)
            VALUES (${id}, ${ticker}, 'STOCK', ${amount}, ${effectivePrice}, ${currency})
        `;
        } else {
            let newQty = Number(existing.quantity);
            let newAvg = Number(existing.average_buy_price);

            if (type === 'BUY') {
                // Coste total = inversión actual + nueva inversión (incluyendo comisión)
                const currentCost = newQty * newAvg;
                const newCost = Number(amount) * Number(price) + Number(commission);
                const totalCost = currentCost + newCost;
                newQty += Number(amount);
                newAvg = totalCost / newQty;
            } else {
                // Venta: solo reduce cantidad (comisión se registra para reporting)
                newQty -= Number(amount);
                if (newQty < 0) throw new Error('Insufficient balance');
            }

            if (newQty === 0) {
                await sql`DELETE FROM positions WHERE id = ${existing.id}`;
            } else {
                await sql`
                UPDATE positions 
                SET quantity = ${newQty}, average_buy_price = ${newAvg}, updated_at = NOW()
                WHERE id = ${existing.id}
            `;
            }
        }

        return { success: true };
    }, {
        body: t.Object({
            ticker: t.String(),
            amount: t.Number(),
            price: t.Number(),
            commission: t.Optional(t.Number()),
            type: t.String(),
            currency: t.String(),
            exchangeRateToEur: t.Optional(t.Number())
        })
    })
    // Eliminar una posición completa
    .delete('/:id/positions/:positionId', async ({ userId, params }) => {
        const { id, positionId } = params;

        // Verificar propiedad del portfolio
        const [portfolio] = await sql`SELECT id FROM portfolios WHERE id = ${id} AND user_id = ${userId}`;
        if (!portfolio) {
            throw new Error('Portfolio not found');
        }

        // Verificar que la posición pertenece al portfolio
        const [position] = await sql`SELECT id, ticker FROM positions WHERE id = ${positionId} AND portfolio_id = ${id}`;
        if (!position) {
            throw new Error('Position not found');
        }

        // Eliminar la posición
        await sql`DELETE FROM positions WHERE id = ${positionId}`;

        // Eliminar también las transacciones asociadas (eliminación completa por error de entrada)
        await sql`DELETE FROM transactions WHERE portfolio_id = ${id} AND ticker = ${position.ticker}`;

        console.log(`Deleted position ${positionId} (${position.ticker}) and associated transactions from portfolio ${id}`);
        return { success: true, message: `Posición ${position.ticker} y sus transacciones eliminadas` };
    })
    // Editar una posición (cantidad y precio medio)
    .put('/:id/positions/:positionId', async ({ userId, params, body }) => {
        const { id, positionId } = params;
        // @ts-ignore
        const { quantity, averagePrice } = body;

        // Verificar propiedad del portfolio
        const [portfolio] = await sql`SELECT id FROM portfolios WHERE id = ${id} AND user_id = ${userId}`;
        if (!portfolio) {
            throw new Error('Portfolio not found');
        }

        // Verificar que la posición existe
        const [position] = await sql`SELECT id, ticker FROM positions WHERE id = ${positionId} AND portfolio_id = ${id}`;
        if (!position) {
            throw new Error('Position not found');
        }

        // Actualizar la posición
        await sql`
            UPDATE positions 
            SET quantity = ${quantity}, average_buy_price = ${averagePrice}, updated_at = NOW()
            WHERE id = ${positionId}
        `;

        console.log(`Updated position ${positionId} (${position.ticker}): quantity=${quantity}, avgPrice=${averagePrice}`);
        return { success: true, message: `Posición ${position.ticker} actualizada` };
    }, {
        body: t.Object({
            quantity: t.Number(),
            averagePrice: t.Number()
        })
    }, {
        body: t.Object({
            quantity: t.Number(),
            averagePrice: t.Number()
        })
    })
    // PnL History for Chart (Unrealized PnL of current positions over time)
    .get('/:id/pnl-history', async ({ userId, params }) => {
        const { id } = params;
        const days = 180; // 6 months history

        // 1. Get positions
        const positions = await sql`SELECT * FROM positions WHERE portfolio_id = ${id}`;

        if (!positions || positions.length === 0) return [];

        // 2. Get unique tickers and currencies (Normalized)
        const tickers = [...new Set(positions.map(p => p.ticker ? p.ticker.toUpperCase() : ''))].filter(t => t);
        const currencies = [...new Set(positions.map(p => p.currency ? p.currency.toUpperCase() : ''))].filter(c => c && c !== 'EUR');

        console.log(`[PnL] Computing for tickers: ${tickers.join(', ')}`);

        // 3. Sync/Fetch historical data for tickers
        const historyData: Record<string, any[]> = {};
        for (const ticker of tickers) {
            try {
                // Ensure we have data in DB
                await MarketDataService.getDetailedHistory(ticker, 1); // 1 year fallback

                // Query DB for the specific range
                const hist = await sql`
                    SELECT date, close 
                    FROM historical_data 
                    WHERE ticker = ${ticker} 
                    AND date >= NOW() - INTERVAL '6 months' 
                    ORDER BY date ASC
                `;
                historyData[ticker] = hist;
                console.log(`[PnL] ${ticker}: ${hist.length} history points`);
            } catch (err) {
                console.error(`[PnL] Error fetching history for ${ticker}:`, err);
                historyData[ticker] = [];
            }
        }

        // 4. Sync/Fetch historical data for currencies (to EUR)
        const currencyData: Record<string, any[]> = {};
        for (const currency of currencies) {
            const pair = `${currency}/EUR`;
            try {
                // Check if we have data for this pair in historical_data
                let hist = await sql`
                    SELECT date, close 
                    FROM historical_data 
                    WHERE ticker = ${pair} 
                    AND date >= NOW() - INTERVAL '6 months'
                    ORDER BY date ASC
                `;

                if (hist.length === 0) {
                    console.log(`[PnL] Missing history for currency ${pair}. Triggering sync...`);
                    // Attempt basic fill (calls getDetailedHistory logic adapted for currencies or simple sync)
                    // Reusing syncCurrencyHistory logic locally for this specific pair
                    // WORKAROUND: Force a global syncCurrencyHistory since it reads derived positions.
                    await MarketDataService.syncCurrencyHistory(6);

                    // Retry read
                    hist = await sql`
                        SELECT date, close 
                        FROM historical_data 
                        WHERE ticker = ${pair} 
                        AND date >= NOW() - INTERVAL '6 months'
                        ORDER BY date ASC
                    `;
                }
                currencyData[currency] = hist;
            } catch (err) {
                console.error(`[PnL] Error fetching currency history for ${currency}:`, err);
                currencyData[currency] = [];
            }
        }

        // 5. Aggregate PnL per day
        // Create a map of Date -> PnL
        const pnlMap: Record<string, number> = {};
        const datesSet = new Set<string>();

        // Collect all dates from all tickers
        Object.values(historyData).forEach(list => {
            list.forEach(item => datesSet.add(new Date(item.date).toISOString().split('T')[0]));
        });

        const sortedDates = Array.from(datesSet).sort();

        // Helper to get price at date (or previous close if missing)
        const getPriceAtDate = (ticker: string, dateStr: string) => {
            const list = historyData[ticker] || [];
            // Find exact match
            const exact = list.find(d => new Date(d.date).toISOString().split('T')[0] === dateStr);
            if (exact) return Number(exact.close);

            // Find closest previous
            // Optimization: Iterate backwards from date
            return 0; // Fallback if no data (assume 0 value? or exclude?)
        };

        // Helper to get rate at date
        const getRateAtDate = (curr: string, dateStr: string) => {
            if (curr === 'EUR') return 1.0;
            const list = currencyData[curr] || [];
            const exact = list.find(d => new Date(d.date).toISOString().split('T')[0] === dateStr);
            if (exact) return Number(exact.close);
            return 1.0; // Fallback to 1.0 implies parity or missing data
        };

        for (const dateStr of sortedDates) {
            let totalValue = 0;
            let totalCost = 0;
            let hasData = false;

            for (const pos of positions) {
                const price = getPriceAtDate(pos.ticker, dateStr);

                // Only count if we have price data (otherwise it skews the graph abruptly)
                if (price > 0) {
                    hasData = true;
                    const rate = getRateAtDate(pos.currency, dateStr);
                    const qty = Number(pos.quantity);
                    const avgPrice = Number(pos.average_buy_price);

                    const valueEur = qty * price * rate;
                    const costEur = qty * avgPrice * rate; // Using historical rate for cost too to see "Unrealized PnL" in EUR terms at that moment? 
                    // Actually, usually "Cost Basis" is fixed in base currency at time of purchase. 
                    // If we stored cost_basis_eur in DB, we'd use that. 
                    // Since we calculate on fly, keeping it simple: compare (ValueInEUR - CostInEUR_AtCurrentRate) 
                    // or (ValueInEUR - CostInEUR_Fixed). 
                    // Let's assume CostInEUR is relatively fixed or we use the current rate to approximate "what if I sold now vs bought now".
                    // Standard PnL: (Current Price - Avg Price) * Qty. Converted to EUR.

                    const pnlInAssetCurrency = (price - avgPrice) * qty;
                    const pnlInEur = pnlInAssetCurrency * rate;

                    totalValue += pnlInEur;
                }
            }

            // Only add point if we had valid stock data
            if (hasData) {
                pnlMap[dateStr] = totalValue; // This is Total Unrealized PnL
            }
        }

        return sortedDates.map(date => ({
            time: date,
            value: pnlMap[date] || 0
        })).filter(p => p.value !== 0); // Cleanup zeros if needed
    });

