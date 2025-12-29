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
        console.log(`Found ${conversations.length} conversations`);
        return conversations;
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

    // Send message and get AI response
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

        // Save user message
        const [userMsg] = await sql`
            INSERT INTO chat_messages (conversation_id, role, content)
            VALUES (${params.id}, 'user', ${message})
            RETURNING id, role, content, created_at
        `;

        // Get conversation history for AI context
        const history = await sql`
            SELECT role, content as text
            FROM chat_messages
            WHERE conversation_id = ${params.id}
            ORDER BY created_at ASC
        `;

        // Get AI response
        let aiResponse: string;
        try {
            const response = await AIService.chatWithBot(userId, body.messages);
            aiResponse = response; // Assign response to aiResponse
        } catch (error) {
            console.error('AI Error:', error);
            aiResponse = 'Lo siento, hubo un problema al procesar tu mensaje. Intenta de nuevo.';
        }

        // Save AI response
        const [aiMsg] = await sql`
            INSERT INTO chat_messages (conversation_id, role, content)
            VALUES (${params.id}, 'model', ${aiResponse})
            RETURNING id, role, content, created_at
        `;

        // Update conversation title if it's the first user message
        const messageCount = await sql`
            SELECT COUNT(*) as count FROM chat_messages 
            WHERE conversation_id = ${params.id} AND role = 'user'
        `;

        if (parseInt(messageCount[0].count) === 1) {
            // Generate title from first message (first 50 chars)
            const title = message.length > 50 ? message.substring(0, 47) + '...' : message;
            await sql`
                UPDATE chat_conversations 
                SET title = ${title}, updated_at = NOW()
                WHERE id = ${params.id}
            `;
        } else {
            // Just update the timestamp
            await sql`
                UPDATE chat_conversations 
                SET updated_at = NOW()
                WHERE id = ${params.id}
            `;
        }

        return { userMessage: userMsg, aiMessage: aiMsg };
    }, {
        body: t.Object({
            message: t.String()
        })
    });
