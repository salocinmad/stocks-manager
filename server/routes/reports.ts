import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { PnLService } from '../services/pnlService';
import sql from '../db';

export const reportsRoutes = new Elysia({ prefix: '/reports' })
    .use(
        jwt({
            name: 'jwt',
            secret: process.env.JWT_SECRET || 'changeme_in_prod'
        })
    )
    .derive(async ({ jwt, headers, query, set }) => {
        const auth = headers['authorization'];
        if (!auth?.startsWith('Bearer ')) {
            set.status = 401;
            throw new Error('Unauthorized');
        }
        const profile = await jwt.verify(auth.slice(7)) as any;
        if (!profile?.sub) {
            set.status = 401;
            throw new Error('Unauthorized');
        }

        const userId = profile.sub;
        let portfolioId = query?.portfolioId;

        if (portfolioId) {
            // Verify ownership
            const [owned] = await sql`SELECT id FROM portfolios WHERE id = ${portfolioId} AND user_id = ${userId}`;
            if (!owned) {
                set.status = 403;
                throw new Error('Forbidden: You do not own this portfolio');
            }
        } else {
            // Default to favorite
            const portfolios = await sql`SELECT id FROM portfolios WHERE user_id = ${userId} ORDER BY is_favorite DESC LIMIT 1`;
            if (portfolios.length > 0) {
                portfolioId = portfolios[0].id;
            }
        }

        return { userId, portfolioId };
    })
    .get('/tax', async ({ portfolioId }) => {
        if (!portfolioId) return { error: 'No portfolio found' };
        const fullReport = await PnLService.calculateRealizedPnL_FIFO(portfolioId);
        return { operations: fullReport };
    }, {
        query: t.Object({ portfolioId: t.Optional(t.String()) })
    })
    .get('/years', async ({ portfolioId }) => {
        if (!portfolioId) return [new Date().getFullYear()];

        try {
            // We want years that have ANY transaction (could be a buy that will be sold later)
            // Or more strictly, years that have realized operations? 
            // Better to show all years with transactions so users can see they have things.
            const years = await sql`
                SELECT DISTINCT EXTRACT(YEAR FROM date) as year 
                FROM transactions 
                WHERE portfolio_id = ${portfolioId} 
                ORDER BY year DESC
            `;

            if (years.length === 0) return [new Date().getFullYear()];
            return years.map(r => Number(r.year));
        } catch (e) {
            console.error('Error fetching years:', e);
            return [new Date().getFullYear()];
        }
    }, {
        query: t.Object({ portfolioId: t.Optional(t.String()) })
    })
    .get('/aeat/:year', async ({ params, portfolioId }) => {
        if (!portfolioId) {
            return { summary: { totalGainLoss: 0, totalOperations: 0 }, operations: [] };
        }

        const year = parseInt(params.year);
        const fullReport = await PnLService.calculateRealizedPnL_FIFO(portfolioId);

        // Filter by Sold Date Year
        const filteredOps = fullReport.filter(op => {
            const opYear = new Date(op.sellDate).getFullYear();
            return opYear === year;
        });

        // Map to Frontend Structure
        const operations = filteredOps.map(op => ({
            ticker: op.ticker,
            saleDate: op.sellDate,
            buyDate: op.buyDate,
            qty: op.quantity,
            salePriceEur: Number(op.sellPriceEur),
            buyPriceEur: Number(op.buyPriceEur),
            salePriceOrig: Number(op.sellPriceOrig),
            buyPriceOrig: Number(op.buyPriceOrig),
            saleRate: Number(op.sellRate),
            buyRate: Number(op.buyRate),
            gainLossEur: op.gainEur,
            currency: op.currency
        }));

        const totalGainLoss = operations.reduce((acc, curr) => acc + curr.gainLossEur, 0);

        return {
            summary: {
                totalGainLoss,
                totalOperations: operations.length
            },
            operations
        };
    }, {
        params: t.Object({ year: t.String() }),
        query: t.Object({ portfolioId: t.Optional(t.String()) })
    });
