import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import sql from '../db';
import { AIService } from '../services/aiService';

export const chatRoutes = new Elysia({ prefix: '/chat' })
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

    // Get all conversations for user (sorted by most recent)
    .get('/conversations', async ({ userId }) => {

        const conversations = await sql`
            SELECT 
                c.id, 
                c.title, 
                c.created_at,
                c.updated_at,
                (SELECT COUNT(*)::int FROM chat_messages WHERE conversation_id = c.id) as message_count
            FROM chat_conversations c
            WHERE c.user_id = ${userId}
            ORDER BY c.updated_at DESC
        `;
        return [...conversations];
    })

    // Create new conversation
    .post('/conversations', async ({ userId }) => {
        const [conversation] = await sql`
            INSERT INTO chat_conversations (user_id, title)
            VALUES (${userId}, 'Nueva conversación')
            RETURNING id, title, created_at, updated_at
        `;

        // Add initial greeting message
        await sql`
            INSERT INTO chat_messages (conversation_id, role, content)
            VALUES (${conversation.id}, 'model', '¡Hola! Soy Stocks Bot. Puedo ayudarte a analizar tu portafolio, explicarte términos financieros o darte insights sobre tus inversiones. ¿En qué puedo ayudarte?')
        `;

        return conversation;
    })

    // Get messages for a specific conversation
    .get('/conversations/:id', async ({ userId, params, set }) => {
        // Verify ownership
        const [conversation] = await sql`
            SELECT id, title, created_at, updated_at 
            FROM chat_conversations 
            WHERE id = ${params.id} AND user_id = ${userId}
        `;

        if (!conversation) {
            set.status = 404;
            return { error: 'Conversation not found' };
        }

        const messages = await sql`
            SELECT id, role, content, created_at
            FROM chat_messages
            WHERE conversation_id = ${params.id}
            ORDER BY created_at ASC
        `;

        return { conversation, messages };
    })

    // Delete a specific conversation
    .delete('/conversations/:id', async ({ userId, params, set }) => {
        const result = await sql`
            DELETE FROM chat_conversations 
            WHERE id = ${params.id} AND user_id = ${userId}
            RETURNING id
        `;

        if (result.length === 0) {
            set.status = 404;
            return { error: 'Conversation not found' };
        }

        return { success: true };
    })

    // Delete ALL conversations (for user security/privacy)
    .delete('/conversations', async ({ userId }) => {
        await sql`
            DELETE FROM chat_conversations 
            WHERE user_id = ${userId}
        `;

        return { success: true, message: 'All conversations deleted' };
    })

    // Send message and get AI response (STREAMING)
    .post('/conversations/:id/messages', async ({ userId, params, body, set }) => {
        // Verify ownership
        const [conversation] = await sql`
            SELECT id FROM chat_conversations 
            WHERE id = ${params.id} AND user_id = ${userId}
        `;

        if (!conversation) {
            set.status = 404;
            return { error: 'Conversation not found' };
        }

        // @ts-ignore
        const { message } = body;

        // Save user message (Synchronous)
        const [userMsg] = await sql`
            INSERT INTO chat_messages (conversation_id, role, content)
            VALUES (${params.id}, 'user', ${message})
            RETURNING id, role, content, created_at
        `;

        // Get conversation history for AI context
        // Get conversation history for AI context
        const history = await sql`
            SELECT role, content as text
            FROM chat_messages
            WHERE conversation_id = ${params.id}
            ORDER BY created_at ASC
        `;

        // Start AI Stream
        let geminiStream;
        try {
            geminiStream = await AIService.chatWithBotStream(userId, history);
        } catch (error: any) {
            console.error('[Chat] Stream start error:', error);

            // Check for 429/Quota or generic error
            const isQuota = error.message?.includes('429') || error.status === 429;
            const errorMsg = isQuota
                ? "⚠️ El sistema de IA está saturado momentáneamente (Límite de cuota gratuito). Por favor espera 30 segundos y vuelve a intentar."
                : "⚠️ Error al conectar con el cerebro de la IA. Inténtalo de nuevo.";

            // Return error as a simulated stream or just a 503 status
            // Better to return status so frontend handles it, BUT frontend expects stream.
            // Let's mimic a stream with the error message to display it in the bubble.

            // return new Response(errorMsg, { status: 200 }); // Return as plain text, frontend might just display it?
            // Actually frontend expects chunks. Let's send a fake stream.

            const iterator = (async function* () {
                yield { text: () => errorMsg };
            })();
            geminiStream = iterator;
        }

        let fullResponse = "";

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Send User Message metadata first as a special JSON chunk (or header-like)? 
                    // No, frontend expects JSON OR stream. We will send ONLY text stream content.
                    // Frontend will assume successful user msg insertion.

                    for await (const chunk of geminiStream) {
                        if (typeof chunk.text === 'function') {
                            const text = chunk.text();
                            fullResponse += text;
                            controller.enqueue(new TextEncoder().encode(text));
                        } else {
                            console.warn('[Chat] Invalid chunk received', chunk);
                        }
                    }

                    // After stream finished, save to DB
                    if (fullResponse) {
                        await sql`
                            INSERT INTO chat_messages (conversation_id, role, content)
                            VALUES (${params.id}, 'model', ${fullResponse})
                        `;

                        // Update Conversation Meta
                        await sql`
                            UPDATE chat_conversations 
                            SET updated_at = NOW()
                            WHERE id = ${params.id}
                        `;

                        // Update Title if it was the first message
                        const messageCount = await sql`SELECT COUNT(*) as count FROM chat_messages WHERE conversation_id = ${params.id} AND role = 'user'`;
                        if (parseInt(messageCount[0].count) === 1) {
                            const title = message.length > 50 ? message.substring(0, 47) + '...' : message;
                            await sql`UPDATE chat_conversations SET title = ${title} WHERE id = ${params.id}`;
                        }
                    }

                } catch (e) {
                    console.error("Stream Error", e);
                    controller.enqueue(new TextEncoder().encode("\n[Error de conexión con IA]"));
                } finally {
                    controller.close();
                }
            }
        });

        // Return raw text stream. 
        // Note: Frontend needs to verify success of User Msg via seeing the stream start.
        return new Response(stream, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });

    }, {
        body: t.Object({
            message: t.String()
        })
    });
