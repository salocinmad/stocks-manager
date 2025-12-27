import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import sql from '../db';
import { MarketDataService } from '../services/marketData';
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

        console.log(`Reordering portfolio ${id}, items: ${orderedIds?.length}`);

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
    // PnL History for Chart (Reads from pre-calculated cache, updated daily at 4:00 AM)
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

        try {
            // Read from cache (pre-calculated by job at 4:00 AM)
            const cachedData = await sql`
                SELECT date, pnl_eur 
                FROM pnl_history_cache 
                WHERE portfolio_id = ${id}
                AND date >= ${cutoffStr}::date
                ORDER BY date ASC
            `;

            if (cachedData && cachedData.length > 0) {
                // Format for lightweight-charts (YYYY-MM-DD)
                return cachedData.map(row => {
                    const d = new Date(row.date);
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const year = d.getFullYear();
                    return {
                        time: `${year}-${month}-${day}`,
                        value: Number(row.pnl_eur) || 0
                    };
                });
            }

            // If no cache, trigger initial calculation (runs in background)
            console.log(`[PnL] No cache for portfolio ${id}. Triggering initial calculation...`);

            // Don't await - let it run in background
            calculatePnLWeekly().catch(e => console.error('[PnL] Background calc error:', e));

            return []; // Return empty for now, will have data after background job finishes
        } catch (error) {
            console.error('[PnL History] Error:', error);
            return [];
        }
    });
