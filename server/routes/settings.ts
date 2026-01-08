import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { join } from 'path';

// Helper: read env file manual parse (since we want to edit it too)
const ENV_PATH = '/app/.env';

export const settingsRoutes = new Elysia({ prefix: '/settings' })
    .use(
        jwt({
            name: 'jwt',
            secret: process.env.JWT_SECRET || 'changeme_in_prod'
        })
    )
    .derive(async ({ jwt, headers, set }) => {
        // Auth check - similar to other routes
        // (In a real app, maybe add 'role: admin' check)
        const auth = headers['authorization'];
        if (!auth?.startsWith('Bearer ')) {
            set.status = 401;
            throw new Error('Unauthorized');
        }
        const token = auth.slice(7);
        const profile = await jwt.verify(token);
        if (!profile) {
            set.status = 401;
            throw new Error('Unauthorized');
        }
        return { userId: profile.sub };
    })
    .get('/env', async ({ set }) => {
        return {
            finnhub: process.env.FINNHUB_API_KEY || '',
            google: process.env.GOOGLE_GENAI_API_KEY || ''
        };
    })
    .post('/env', async ({ body, set }) => {
        const { finnhub, google } = body as { finnhub: string; google: string };

        try {
            let path = ENV_PATH;
            let file = Bun.file(path);
            if (!(await file.exists())) {
                path = '.env';
                file = Bun.file(path);
            }

            let text = '';
            if (await file.exists()) {
                text = await file.text();
            } else {
                // Should basically not happen if setup is correct, but let's handle create
                text = '';
            }

            // Simple regex replacement/append
            let newText = text;

            // FINNHUB
            if (newText.includes('FINNHUB_API_KEY=')) {
                newText = newText.replace(/FINNHUB_API_KEY=.*/g, `FINNHUB_API_KEY=${finnhub}`);
            } else {
                newText += `\nFINNHUB_API_KEY=${finnhub}`;
            }

            // GOOGLE (Using correct name from .env)
            if (newText.includes('GOOGLE_GENAI_API_KEY=')) {
                newText = newText.replace(/GOOGLE_GENAI_API_KEY=.*/g, `GOOGLE_GENAI_API_KEY=${google}`);
            } else {
                newText += `\nGOOGLE_GENAI_API_KEY=${google}`;
            }

            // Clean up empty lines potentially
            newText = newText.replace(/^\s*[\r\n]/gm, '');

            await Bun.write(path, newText);

            // Update process.env for immediate use (though restarts are better)
            process.env.FINNHUB_API_KEY = finnhub;
            process.env.GOOGLE_GENAI_API_KEY = google;



            return { success: true, message: 'Keys updated. Restart container if issues persist.' };

        } catch (error) {
            console.error('Error saving env settings:', error);
            set.status = 500;
            return { error: 'Failed to save settings' };
        }
    }, {
        body: t.Object({
            finnhub: t.String(),
            google: t.String()
        })
    });
