import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import sql from '../db';
import { MarketDataService } from '../services/marketData';
import { PortfolioService } from '../services/portfolioService';
import { calculatePnLWeekly } from '../jobs/pnlJob';

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


        return { userId: profile.sub as string };
    })
    // List Portfolios
    // List Portfolios
    .get('/', async ({ userId }) => {
        try {

            const portfolios = await sql`
                SELECT id, name, is_public, is_favorite, created_at, 
                (SELECT COUNT(*) FROM positions WHERE portfolio_id = portfolios.id) as positions_count
                FROM portfolios 
                WHERE user_id = ${userId}
                ORDER BY is_favorite DESC, created_at ASC
            `;

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
                    SELECT p.*, port.name as portfolio_name,
                        COALESCE((SELECT SUM(fees) FROM transactions WHERE portfolio_id = p.portfolio_id AND ticker = p.ticker AND type = 'BUY'), 0) as tx_fees_sum
                    FROM positions p
                    JOIN portfolios port ON p.portfolio_id = port.id
                    WHERE port.user_id = ${userId} AND port.id = ${portfolioId}
                `;
            } else {
                positions = await sql`
                    SELECT p.*, port.name as portfolio_name,
                        COALESCE((SELECT SUM(fees) FROM transactions WHERE portfolio_id = p.portfolio_id AND ticker = p.ticker AND type = 'BUY'), 0) as tx_fees_sum
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
            const tickers = [...new Set(positions.map(p => p.ticker))] as string[];
            const quotes: Record<string, any> = {};

            await Promise.all(tickers.map(async (ticker) => {
                quotes[ticker] = await MarketDataService.getQuote(ticker);
            }));

            // 3. Obtener tipos de cambio necesarios a EUR
            const uniqueCurrencies = new Set<string>();
            positions.forEach(p => { if (p.currency) uniqueCurrencies.add(p.currency); });
            // Add quote currencies for accurate live rate conversion
            Object.values(quotes).forEach((q: any) => { if (q && q.currency) uniqueCurrencies.add(q.currency); });

            const rates: Record<string, number> = { 'EUR': 1.0 };
            // console.log(`[Summary] Currencies (pos+quote): ${Array.from(uniqueCurrencies).join(', ')}`);

            await Promise.all(Array.from(uniqueCurrencies).map(async (curr) => {
                if (curr !== 'EUR') {
                    const rate = await MarketDataService.getExchangeRate(curr, 'EUR');
                    rates[curr] = rate || 1.0;
                }
            }));

            // 3b. Obtener sectores
            const sectors = await MarketDataService.getSectors(tickers);

            // 4. Calcular métricas consolidadas
            let totalValueEur = 0;
            let totalCostEur = 0;
            const distMap: Record<string, number> = {};
            const sectorMap: Record<string, number> = {};

            positions.forEach(p => {
                const quote = quotes[p.ticker];
                const posRate = rates[p.currency || 'EUR'] || 1.0;
                const qty = Number(p.quantity);
                const avgPrice = Number(p.average_buy_price) || 0;
                // Use the sum of transaction fees instead of stale positions.commission
                const commission = Number(p.tx_fees_sum) || 0;

                // Costo total en EUR (Usar moneda de la posición) + Comisión
                const costEur = (qty * avgPrice + commission) * posRate;
                totalCostEur += costEur;

                let currentValEur = 0;

                if (quote && quote.c) {
                    // CRITICAL: Use Quote Currency for Live Price (Handles GBP vs GBX mismatch)
                    const quoteRate = rates[quote.currency] || 1.0;
                    currentValEur = qty * quote.c * quoteRate;
                    totalValueEur += currentValEur;
                } else {
                    // Fallback to position currency/price if no quote
                    const val = qty * avgPrice * posRate;
                    totalValueEur += val;
                    currentValEur = val;
                }

                // Distribución por Tipo de Activo
                const type = p.asset_type || 'STOCK';
                distMap[type] = (distMap[type] || 0) + currentValEur;

                // Distribución por Sector
                const sector = sectors[p.ticker] || 'Unknown';
                sectorMap[sector] = (sectorMap[sector] || 0) + currentValEur;
            });

            // Calculate today's PnL
            const todayPnL = totalValueEur - totalCostEur;

            // Get yesterday's PnL from cache for consistent Daily Variation
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            let yesterdayPnL = 0;
            if (portfolioId && portfolioId !== 'all') {
                const cached = await sql`
                    SELECT pnl_eur FROM pnl_history_cache 
                    WHERE portfolio_id = ${portfolioId} AND date = ${yesterdayStr}::date
                    LIMIT 1
                `;
                yesterdayPnL = cached.length > 0 ? Number(cached[0].pnl_eur) || 0 : 0;
            } else {
                // Sum all portfolios for user
                const userPortfolios = await sql`SELECT id FROM portfolios WHERE user_id = ${userId}`;
                for (const p of userPortfolios) {
                    const cached = await sql`
                        SELECT pnl_eur FROM pnl_history_cache 
                        WHERE portfolio_id = ${p.id} AND date = ${yesterdayStr}::date
                        LIMIT 1
                    `;
                    if (cached.length > 0) {
                        yesterdayPnL += Number(cached[0].pnl_eur) || 0;
                    }
                }
            }

            // Daily Change = Today's PnL - Yesterday's PnL (consistent with chart)
            const dailyChangeEur = todayPnL - yesterdayPnL;
            const dailyChangePercent = yesterdayPnL !== 0 ? (dailyChangeEur / Math.abs(yesterdayPnL)) * 100 : 0;

            const totalGainEur = todayPnL;
            const totalGainPercent = totalCostEur > 0 ? (totalGainEur / totalCostEur) * 100 : 0;

            const distribution = Object.entries(distMap).map(([name, value]) => ({
                name: name === 'STOCK' ? 'Acciones' : name === 'CRYPTO' ? 'Cripto' : name === 'CASH' ? 'Efectivo' : name,
                value,
                color: name === 'STOCK' ? '#fce903' : name === 'CRYPTO' ? '#94a3b8' : '#3b82f6'
            })).filter(d => d.value > 0);

            const sectorAllocation = Object.entries(sectorMap).map(([name, value]) => ({
                name,
                value
            })).sort((a, b) => b.value - a.value).filter(d => d.value > 0);

            // 5. Calcular Ganadores y Perdedores (Top 3)
            const performanceList = positions.map(p => {
                const quote = quotes[p.ticker];
                let changePercent = 0;
                let change = 0;
                let price = 0;

                if (quote) {
                    price = quote.c || 0;
                    if (quote.dp !== undefined && quote.dp !== null) {
                        changePercent = quote.dp;
                    } else if (quote.c && quote.pc) {
                        changePercent = ((quote.c - quote.pc) / quote.pc) * 100;
                    }

                    if (quote.d !== undefined && quote.d !== null) {
                        change = quote.d;
                    } else if (quote.c && quote.pc) {
                        change = quote.c - quote.pc;
                    }
                }

                return {
                    ticker: p.ticker,
                    name: p.portfolio_name, // Optional context
                    price,
                    change,
                    changePercent,
                    currency: quote?.currency || p.currency
                };
            }).filter(p => p.price > 0); // Exclude items with no price data

            // Sort by Change % Descending (High to Low)
            const sortedByPerformance = [...performanceList].sort((a, b) => b.changePercent - a.changePercent);

            const topGainers = sortedByPerformance.slice(0, 3).filter(p => p.changePercent > 0);
            const topLosers = sortedByPerformance.slice(-3).filter(p => p.changePercent < 0);

            return {
                totalValueEur,
                dailyChangeEur,
                dailyChangePercent,
                totalGainEur,
                totalGainPercent,
                distribution,
                sectorAllocation,
                topGainers,
                topLosers
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
        SELECT * FROM positions 
        WHERE portfolio_id = ${id}
        ORDER BY display_order ASC, ticker ASC
    `;

        // Force plain object return
        return {
            ...portfolio,
            positions: [...positions].map(p => ({ ...p, quantity: Number(p.quantity), average_buy_price: Number(p.average_buy_price) }))
        };
    })
    // Reorder Positions
    .patch('/:id/positions/reorder', async ({ userId, params, body, set }) => {
        const { id } = params;
        // @ts-ignore
        const { orderedIds } = body;



        if (!orderedIds || !Array.isArray(orderedIds)) {
            set.status = 400;
            return { error: 'Invalid body, expected orderedIds array' };
        }

        // Verify ownership
        const [portfolio] = await sql`SELECT id FROM portfolios WHERE id = ${id} AND user_id = ${userId}`;
        if (!portfolio) {
            set.status = 404;
            return { error: 'Portfolio not found' };
        }

        // Update orders in a transaction
        try {
            await sql.begin(async sql => {
                for (let i = 0; i < orderedIds.length; i++) {
                    const positionId = orderedIds[i];
                    await sql`
                        UPDATE positions 
                        SET display_order = ${i} 
                        WHERE id = ${positionId} AND portfolio_id = ${id}
                    `;
                }
            });
            return { success: true };
        } catch (error) {
            console.error('Error reordering positions:', error);
            set.status = 500;
            return { error: 'Failed to reorder positions' };
        }
    }, {
        body: t.Object({
            orderedIds: t.Array(t.String())
        })
    })
    // Add/Update Position (Simplified logic: Upsert)
    .post('/:id/positions', async ({ userId, params, body, set }) => {
        const { id } = params;


        if (!id || id === 'undefined' || id === 'null') {
            console.error('Invalid portfolio ID:', id);
            throw new Error('Invalid portfolio ID');
        }

        // @ts-ignore
        const { ticker, amount, price, commission = 0, type, currency, exchangeRateToEur, exchange_rate_to_eur } = body;

        // Verify ownership
        const [portfolio] = await sql`SELECT id FROM portfolios WHERE id = ${id} AND user_id = ${userId}`;
        if (!portfolio) {
            console.error('Portfolio not found for id:', id, 'userId:', userId);
            throw new Error('Portfolio not found');
        }

        const exchangeRate = exchangeRateToEur !== undefined ? exchangeRateToEur : (exchange_rate_to_eur !== undefined ? exchange_rate_to_eur : 1.0);

        console.log('DEBUG: POST /positions payload:', JSON.stringify(body));
        console.log('DEBUG: Evaluated exchangeRate:', exchangeRate);

        try {
            await PortfolioService.addTransaction(
                id,
                ticker,
                type as 'BUY' | 'SELL',
                Number(amount),
                Number(price),
                currency,
                Number(commission),
                Number(exchangeRate)
            );
        } catch (error: any) {
            set.status = 400;
            return { error: error.message || 'Failed to process transaction' };
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


        return { success: true, message: `Posición ${position.ticker} y sus transacciones eliminadas` };
    })
    // Editar una posición (cantidad y precio medio)
    .put('/:id/positions/:positionId', async ({ userId, params, body }) => {
        const { id, positionId } = params;
        // @ts-ignore
        const { quantity, averagePrice, commission } = body;

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
            SET quantity = ${quantity}, average_buy_price = ${averagePrice}, commission = ${commission || 0}, updated_at = NOW()
            WHERE id = ${positionId}
        `;


        return { success: true, message: `Posición ${position.ticker} actualizada` };
    }, {
        body: t.Object({
            quantity: t.Number(),
            averagePrice: t.Number(),
            commission: t.Optional(t.Number())
        })
    })
    // PnL History for Chart (Reads from pre-calculated cache + TODAY's live value)
    .get('/:id/pnl-history', async ({ userId, params, query }) => {
        const { id } = params;
        const period = (query as any)?.period || '3M'; // Default 3 months

        // Calculate date filter based on period
        let monthsBack = 3;
        if (period === '1M') monthsBack = 1;
        else if (period === '1Y') monthsBack = 12;

        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);
        const cutoffStr = cutoffDate.toISOString().split('T')[0];

        // Format for today
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        try {
            // 1. Read historical from cache (pre-calculated by job at 4:00 AM)
            const cachedData = await sql`
                SELECT date, pnl_eur 
                FROM pnl_history_cache 
                WHERE portfolio_id = ${id}
                AND date >= ${cutoffStr}::date
                ORDER BY date ASC
            `;

            // Format historical data
            const result = cachedData.map(row => {
                const d = new Date(row.date);
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                return {
                    time: `${year}-${month}-${day}`,
                    value: Number(row.pnl_eur) || 0
                };
            });

            // 2. Calculate TODAY's live PnL using real-time quotes
            const positions = await sql`
                SELECT ticker, quantity, average_buy_price, currency, asset_type, portfolio_id,
                    COALESCE((SELECT SUM(fees) FROM transactions WHERE portfolio_id = positions.portfolio_id AND ticker = positions.ticker AND type = 'BUY'), 0) as tx_fees_sum
                FROM positions 
                WHERE portfolio_id = ${id} AND quantity > 0
            `;

            if (positions.length > 0) {
                // Get live quotes
                const quotes: Record<string, any> = {};
                const tickers = positions.map(p => p.ticker);
                await Promise.all(tickers.map(async (ticker) => {
                    quotes[ticker] = await MarketDataService.getQuote(ticker);
                }));

                // Get exchange rates
                const currencies = [...new Set(positions.map(p => p.currency))];
                const rates: Record<string, number> = { 'EUR': 1.0 };
                await Promise.all(currencies.map(async (curr) => {
                    if (curr !== 'EUR') {
                        const rate = await MarketDataService.getExchangeRate(curr, 'EUR');
                        rates[curr] = rate || 1.0;
                    }
                }));

                // Calculate live PnL (same as summary)
                let totalValueEur = 0;
                let totalCostEur = 0;

                positions.forEach(p => {
                    const quote = quotes[p.ticker];
                    const posRate = rates[p.currency || 'EUR'] || 1.0;
                    const qty = Number(p.quantity);
                    const avgPrice = Number(p.average_buy_price) || 0;
                    // Use the sum of transaction fees instead of stale positions.commission
                    const commission = Number(p.tx_fees_sum) || 0;

                    // Cost basis uses position currency rate + Commission
                    const costEur = (qty * avgPrice + commission) * posRate;
                    totalCostEur += costEur;

                    if (quote && quote.c) {
                        // CRITICAL: Use quote currency for live price (handles GBX properly)
                        const quoteRate = rates[quote.currency] || posRate;
                        totalValueEur += qty * quote.c * quoteRate;
                    } else {
                        totalValueEur += qty * avgPrice * posRate;
                    }
                });

                const livePnl = Number((totalValueEur - totalCostEur).toFixed(2));

                // 3. Add or replace today's entry
                const existingTodayIndex = result.findIndex(r => r.time === todayStr);
                if (existingTodayIndex >= 0) {
                    result[existingTodayIndex].value = livePnl;
                } else {
                    result.push({ time: todayStr, value: livePnl });
                }
            }

            if (result.length === 0) {
                // If no cache, trigger initial calculation (runs in background)
                calculatePnLWeekly().catch(e => console.error('[PnL] Background calc error:', e));
            }
            return result;
        } catch (error) {
            console.error('[PnL History] Error:', error);
            return [];
        }
    })
    // List All Transactions for Portfolio (Chronological)
    .get('/:id/transactions/all', async ({ userId, params }) => {
        const { id } = params;

        // Verify ownership
        const [portfolio] = await sql`SELECT id FROM portfolios WHERE id = ${id} AND user_id = ${userId}`;
        if (!portfolio) throw new Error('Portfolio not found');

        const transactions = await sql`
            SELECT t.id, t.ticker, t.type, t.amount, t.price_per_unit, t.fees, t.currency, t.exchange_rate_to_eur, t.date,
                   gt.name as company_name
            FROM transactions t
            LEFT JOIN global_tickers gt ON t.ticker = gt.symbol
            WHERE t.portfolio_id = ${id}
            ORDER BY t.date ASC, t.created_at ASC
        `;

        return [...transactions].map(t => ({
            ...t,
            amount: Number(t.amount),
            price_per_unit: Number(t.price_per_unit),
            fees: Number(t.fees),
            exchange_rate_to_eur: Number(t.exchange_rate_to_eur)
        }));
    })
    // Update Transaction
    .put('/:id/transactions/:transactionId', async ({ userId, params, body }) => {
        const { id, transactionId } = params;
        // @ts-ignore
        const { date, amount, price, fees, currency, exchangeRate } = body;

        // Verify ownership
        const [portfolio] = await sql`SELECT id FROM portfolios WHERE id = ${id} AND user_id = ${userId} `;
        if (!portfolio) throw new Error('Portfolio not found');

        try {
            await PortfolioService.updateTransaction(transactionId, id, {
                date,
                amount: amount ? Number(amount) : undefined,
                price: price ? Number(price) : undefined,
                fees: fees !== undefined ? Number(fees) : undefined,
                currency,
                exchange_rate: exchangeRate ? Number(exchangeRate) : undefined
            });

            return { success: true };
        } catch (error: any) {
            console.error('Update Transaction Error:', error);
            throw new Error(error.message || 'Failed to update transaction');
        }
    }, {
        body: t.Object({
            date: t.Optional(t.String()),
            amount: t.Optional(t.Number()),
            price: t.Optional(t.Number()),
            fees: t.Optional(t.Number()),
            currency: t.Optional(t.String()),
            exchangeRate: t.Optional(t.Number())
        })
    })
    // Simulate Sell (FIFO Preview)
    .get('/:id/positions/:ticker/simulate-sell', async ({ userId, params, query, set }) => {
        const { id, ticker } = params;
        // @ts-ignore
        const { amount } = query;

        if (!amount) {
            set.status = 400;
            return { error: 'Amount is required' };
        }

        // Verify ownership
        const [portfolio] = await sql`SELECT id FROM portfolios WHERE id = ${id} AND user_id = ${userId} `;
        if (!portfolio) throw new Error('Portfolio not found');

        try {
            const result = await PortfolioService.simulateSell(id, ticker, Number(amount));
            return result;
        } catch (error: any) {
            console.error('Simulate Sell Error:', error);
            set.status = 400;
            return { error: error.message || 'Simulation failed' };
        }
    });
