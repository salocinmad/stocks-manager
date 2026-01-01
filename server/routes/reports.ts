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
    .get('/tax', async ({ headers, query, set, jwt }) => {
        const auth = headers['authorization'];
        if (!auth?.startsWith('Bearer ')) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }
        const profile = await jwt.verify(auth.slice(7)) as any;
        if (!profile?.sub) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        let portfolioId = query?.portfolioId;
        if (!portfolioId) {
            const portfolios = await sql`SELECT id FROM portfolios WHERE user_id = ${profile.sub} ORDER BY is_favorite DESC LIMIT 1`;
            if (portfolios.length > 0) portfolioId = portfolios[0].id;
        }
        if (!portfolioId) return { error: 'No portfolio found' };

        const fullReport = await PnLService.calculateRealizedPnL_FIFO(portfolioId);
        return { operations: fullReport };
    }, {
        query: t.Object({ portfolioId: t.Optional(t.String()) })
    })
    .get('/years', async ({ headers, query, set, jwt }) => {
        const auth = headers['authorization'];
        if (!auth?.startsWith('Bearer ')) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }
        const profile = await jwt.verify(auth.slice(7)) as any;

        // Find portfolio
        let portfolioId = query?.portfolioId;
        if (!portfolioId) {
            const portfolios = await sql`SELECT id FROM portfolios WHERE user_id = ${profile.sub} ORDER BY is_favorite DESC LIMIT 1`;
            if (portfolios.length > 0) portfolioId = portfolios[0].id;
        }

        // Default to current year if no portfolio or no transactions
        if (!portfolioId) return [new Date().getFullYear()];

        try {
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
    .get('/aeat/:year', async ({ headers, params, query, set, jwt }) => {
        const auth = headers['authorization'];
        if (!auth?.startsWith('Bearer ')) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }
        const profile = await jwt.verify(auth.slice(7)) as any;
        if (!profile?.sub) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        let portfolioId = query?.portfolioId;
        if (!portfolioId) {
            const portfolios = await sql`SELECT id FROM portfolios WHERE user_id = ${profile.sub} ORDER BY is_favorite DESC LIMIT 1`;
            if (portfolios.length > 0) portfolioId = portfolios[0].id;
        }

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
