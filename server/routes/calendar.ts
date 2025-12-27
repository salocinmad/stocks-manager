import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { CalendarService } from '../services/calendarService';

export const calendarRoutes = new Elysia({ prefix: '/calendar' })
    .use(
        jwt({
            name: 'jwt',
            secret: process.env.JWT_SECRET || 'changeme_in_prod',
        })
    )
    .derive(async ({ jwt, headers, set }) => {
        const auth = headers['authorization'];
        if (!auth?.startsWith('Bearer ')) {
            set.status = 401;
            throw new Error('Unauthorized');
        }
        const token = auth.slice(7);
        const profile = await jwt.verify(token) as { sub?: string } | false;

        if (!profile || !profile.sub) {
            set.status = 401;
            throw new Error('Unauthorized');
        }

        return { userId: profile.sub };
    })

    // Get events for a date range
    .get('/events', async ({ userId, query }) => {
        const from = query.from ? new Date(query.from) : new Date();
        const to = query.to ? new Date(query.to) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // Default: 90 days ahead

        return await CalendarService.getEvents(userId, from, to);
    }, {
        query: t.Object({
            from: t.Optional(t.String()),
            to: t.Optional(t.String())
        })
    })

    // Sync events from portfolio (earnings, dividends)
    .post('/sync', async ({ userId }) => {
        const synced = await CalendarService.syncUserEvents(userId);
        return { success: true, synced };
    })

    // Create custom event
    .post('/events', async ({ userId, body }) => {
        const event = await CalendarService.createEvent(userId, body as any);
        return event;
    }, {
        body: t.Object({
            ticker: t.Optional(t.String()),
            event_type: t.String(),
            event_date: t.String(),
            title: t.String(),
            description: t.Optional(t.String())
        })
    })

    // Delete custom event
    .delete('/events/:id', async ({ userId, params, set }) => {
        const deleted = await CalendarService.deleteEvent(userId, params.id);
        if (!deleted) {
            set.status = 404;
            return { error: 'Event not found or not deletable' };
        }
        return { success: true };
    });
