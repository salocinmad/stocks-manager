import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import sql from '../db';

export const watchlistRoutes = new Elysia({ prefix: '/watchlist' })
    .use(
        jwt({
            name: 'jwt',
            secret: process.env.JWT_SECRET || 'changeme_in_prod',
            exp: '2h'
        })
    )
    .derive(async ({ headers, jwt }) => {
        const auth = headers['authorization'];
        if (!auth) throw new Error('Unauthorized');

        const token = auth.split(' ')[1];
        const profile = await jwt.verify(token) as { sub: string } | false;
        if (!profile) throw new Error('Unauthorized');

        return { userId: profile.sub };
    })
    .get('/', async ({ userId }) => {
        const items = await sql`
            SELECT id, ticker, name, created_at 
            FROM watchlists 
            WHERE user_id = ${userId}
            ORDER BY created_at DESC
        `;
        return [...items];
    })
    .post('/', async ({ userId, body, set }) => {
        // @ts-ignore
        const { ticker, name } = body;

        try {
            const [item] = await sql`
                INSERT INTO watchlists (user_id, ticker, name)
                VALUES (${userId}, ${ticker.toUpperCase()}, ${name})
                ON CONFLICT (user_id, ticker) DO UPDATE SET name = EXCLUDED.name
                RETURNING *
            `;
            return item;
        } catch (error) {
            set.status = 500;
            return { error: 'Failed to add to watchlist' };
        }
    }, {
        body: t.Object({
            ticker: t.String(),
            name: t.Optional(t.String())
        })
    })
    .delete('/:ticker', async ({ userId, params }) => {
        const { ticker } = params;
        await sql`
            DELETE FROM watchlists 
            WHERE user_id = ${userId} AND ticker = ${ticker.toUpperCase()}
        `;
        return { success: true };
    });
