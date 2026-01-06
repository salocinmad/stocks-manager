/**
 * Analysis Routes v2.1.0
 * 
 * Endpoints for position analysis, risk metrics and simulations.
 * Uses JWT authentication (same as portfolios.ts)
 */

import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { PositionAnalysisService } from '../services/positionAnalysisService';
import { MarketDataService } from '../services/marketData';
import sql from '../db';

export const analysisRoutes = new Elysia({ prefix: '/analysis' })
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
            set.status = 401;
            throw new Error('Unauthorized: Invalid token');
        }

        return { userId: profile.sub as string };
    })

    // Get full analysis for a position
    .get('/position/:positionId', async ({ params, userId }) => {
        const { positionId } = params;

        // Verify position belongs to user
        const positions = await sql`
            SELECT p.id, p.portfolio_id 
            FROM positions p
            JOIN portfolios pf ON p.portfolio_id = pf.id
            WHERE p.id = ${positionId} AND pf.user_id = ${userId}
        `;

        if (positions.length === 0) {
            return { error: 'Position not found or access denied' };
        }

        const analysis = await PositionAnalysisService.getFullAnalysis(
            positionId,
            positions[0].portfolio_id
        );

        if (!analysis) {
            return { error: 'Could not generate analysis' };
        }

        return analysis;
    }, {
        params: t.Object({
            positionId: t.String()
        })
    })

    // Get analysis for a ticker (Discovery)
    .get('/ticker/:ticker', async ({ params }) => {
        const { ticker } = params;
        const analysis = await PositionAnalysisService.getTickerAnalysis(ticker);

        if (!analysis) {
            return { error: 'Could not generate analysis for ticker' };
        }

        return analysis;
    }, {
        params: t.Object({
            ticker: t.String()
        })
    })

    // Get historical data for a ticker with specific range (Discovery)
    .get('/ticker/:ticker/history', async ({ params, query }) => {
        const { ticker } = params;
        const { range } = query;

        let years = 1;
        if (range === '6m') years = 0.5;
        if (range === '60d') years = 0.17;
        if (range === '30d') years = 0.084;

        const history = await MarketDataService.getDetailedHistory(ticker, years);
        return history;
    }, {
        params: t.Object({
            ticker: t.String()
        }),
        query: t.Object({
            range: t.Optional(t.String())
        })
    })

    // Simulate buy operation
    .post('/simulate/buy', async ({ body, userId }) => {
        const { positionId, additionalQty, buyPrice } = body as any;

        // Get current position data
        const positions = await sql`
            SELECT p.*, pf.user_id,
                   (SELECT SUM(pos.quantity * 100) FROM positions pos WHERE pos.portfolio_id = p.portfolio_id) as portfolio_value
            FROM positions p
            JOIN portfolios pf ON p.portfolio_id = pf.id
            WHERE p.id = ${positionId} AND pf.user_id = ${userId}
        `;

        if (positions.length === 0) {
            return { error: 'Position not found' };
        }

        const pos = positions[0];
        const result = PositionAnalysisService.simulateBuy(
            Number(pos.quantity),
            Number(pos.average_buy_price),
            additionalQty,
            buyPrice,
            Number(pos.portfolio_value) || 10000
        );

        return result;
    }, {
        body: t.Object({
            positionId: t.String(),
            additionalQty: t.Number(),
            buyPrice: t.Number()
        })
    })

    // Simulate sell operation
    .post('/simulate/sell', async ({ body, userId }) => {
        const { positionId, sellQty, currentPrice } = body as any;

        const positions = await sql`
            SELECT p.*, pf.user_id,
                   (SELECT SUM(pos.quantity * 100) FROM positions pos WHERE pos.portfolio_id = p.portfolio_id) as portfolio_value
            FROM positions p
            JOIN portfolios pf ON p.portfolio_id = pf.id
            WHERE p.id = ${positionId} AND pf.user_id = ${userId}
        `;

        if (positions.length === 0) {
            return { error: 'Position not found' };
        }

        const pos = positions[0];
        const result = PositionAnalysisService.simulateSell(
            Number(pos.quantity),
            Number(pos.average_buy_price),
            sellQty,
            currentPrice,
            Number(pos.portfolio_value) || 10000
        );

        return result;
    }, {
        body: t.Object({
            positionId: t.String(),
            sellQty: t.Number(),
            currentPrice: t.Number()
        })
    })

    // Simulate price change
    .post('/simulate/price-change', async ({ body, userId }) => {
        const { positionId, percentChange, currentPrice } = body as any;

        const positions = await sql`
            SELECT p.*, pf.user_id,
                   (SELECT SUM(pos.quantity * 100) FROM positions pos WHERE pos.portfolio_id = p.portfolio_id) as portfolio_value
            FROM positions p
            JOIN portfolios pf ON p.portfolio_id = pf.id
            WHERE p.id = ${positionId} AND pf.user_id = ${userId}
        `;

        if (positions.length === 0) {
            return { error: 'Position not found' };
        }

        const pos = positions[0];
        const result = PositionAnalysisService.simulatePriceChange(
            Number(pos.quantity),
            Number(pos.average_buy_price),
            currentPrice,
            percentChange,
            Number(pos.portfolio_value) || 10000
        );

        return result;
    }, {
        body: t.Object({
            positionId: t.String(),
            percentChange: t.Number(),
            currentPrice: t.Number()
        })
    })

    // Force recalculation of analysis
    .post('/refresh/:positionId', async ({ params, userId }) => {
        const { positionId } = params;

        // Delete cache to force fresh calculation
        await sql`DELETE FROM position_analysis_cache WHERE position_id = ${positionId}`;

        // Get fresh analysis
        const positions = await sql`
            SELECT p.portfolio_id 
            FROM positions p
            JOIN portfolios pf ON p.portfolio_id = pf.id
            WHERE p.id = ${positionId} AND pf.user_id = ${userId}
        `;

        if (positions.length === 0) {
            return { error: 'Position not found' };
        }

        const analysis = await PositionAnalysisService.getFullAnalysis(
            positionId,
            positions[0].portfolio_id
        );

        return analysis || { error: 'Could not refresh analysis' };
    }, {
        params: t.Object({
            positionId: t.String()
        })
    });
