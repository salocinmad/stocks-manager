import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { Stream } from '@elysiajs/stream';
import { AIService } from '../services/aiService';

export const aiRoutes = new Elysia({ prefix: '/ai' })
    .use(
        jwt({
            name: 'jwt',
            secret: process.env.JWT_SECRET || 'changeme_in_prod'
        })
    )
    .derive(async ({ jwt, headers, set }) => {
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
    .post('/chat', async ({ userId, body }) => {
        // @ts-ignore
        const { messages } = body;
        const response = await AIService.chatWithBot(userId, messages);
        return { answer: response };
    }, {
        body: t.Object({
            messages: t.Array(t.Object({
                role: t.String(),
                text: t.String()
            }))
        })
    })


    .post('/analyze', async ({ userId, body }) => {
        // @ts-ignore
        const { message, portfolioId } = body;
        const geminiStream = await AIService.analyzePortfolioStream(userId, message, portfolioId);

        const stream = new ReadableStream({
            async start(controller) {
                for await (const chunk of geminiStream) {
                    controller.enqueue(new TextEncoder().encode(chunk.text()));
                }
                controller.close();
            }
        });

        return new Response(stream, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }, {
        body: t.Object({
            message: t.String(),
            portfolioId: t.Optional(t.String())
        })
    });
