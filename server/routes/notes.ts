import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import sql from '../db';
import { promises as fs } from 'fs';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'notes');

// Ensure uploads directory exists
fs.mkdir(UPLOADS_DIR, { recursive: true }).catch(console.error);

export const notesRoutes = new Elysia({ prefix: '/notes' })
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
        return { userId: profile.sub as string };
    })
    // Get note for a position
    .get('/:positionId', async ({ params, userId, set }) => {
        const { positionId } = params;

        // Verify user owns this position
        const ownership = await sql`
            SELECT p.id FROM positions p
            JOIN portfolios pf ON p.portfolio_id = pf.id
            WHERE p.id = ${positionId} AND pf.user_id = ${userId}
        `;

        if (ownership.length === 0) {
            set.status = 403;
            return { error: 'Not authorized to access this position' };
        }

        const notes = await sql`
            SELECT id, content, created_at, updated_at 
            FROM position_notes 
            WHERE position_id = ${positionId}
        `;

        if (notes.length === 0) {
            return { note: null };
        }

        return { note: notes[0] };
    }, {
        params: t.Object({
            positionId: t.String()
        })
    })
    // Create or update note
    .put('/:positionId', async ({ params, body, userId, set }) => {
        const { positionId } = params;
        const { content } = body;

        // Verify user owns this position
        const ownership = await sql`
            SELECT p.id FROM positions p
            JOIN portfolios pf ON p.portfolio_id = pf.id
            WHERE p.id = ${positionId} AND pf.user_id = ${userId}
        `;

        if (ownership.length === 0) {
            set.status = 403;
            return { error: 'Not authorized to access this position' };
        }

        // Upsert the note
        const result = await sql`
            INSERT INTO position_notes (position_id, content)
            VALUES (${positionId}, ${content})
            ON CONFLICT (position_id) 
            DO UPDATE SET content = ${content}, updated_at = CURRENT_TIMESTAMP
            RETURNING id, content, created_at, updated_at
        `;

        return { note: result[0] };
    }, {
        params: t.Object({
            positionId: t.String()
        }),
        body: t.Object({
            content: t.String()
        })
    })
    // Delete note
    .delete('/:positionId', async ({ params, userId, set }) => {
        const { positionId } = params;

        // Verify user owns this position
        const ownership = await sql`
            SELECT p.id FROM positions p
            JOIN portfolios pf ON p.portfolio_id = pf.id
            WHERE p.id = ${positionId} AND pf.user_id = ${userId}
        `;

        if (ownership.length === 0) {
            set.status = 403;
            return { error: 'Not authorized to access this position' };
        }

        await sql`DELETE FROM position_notes WHERE position_id = ${positionId}`;

        return { success: true };
    }, {
        params: t.Object({
            positionId: t.String()
        })
    })
    // Upload image from clipboard paste
    .post('/upload-image', async ({ body, userId }) => {
        // @ts-ignore - File type handling
        const file = body.image;

        if (!file) {
            return { error: 'No image provided' };
        }

        // Generate unique filename
        const ext = file.name?.split('.').pop() || 'png';
        const filename = `${userId}_${Date.now()}.${ext}`;
        const filepath = path.join(UPLOADS_DIR, filename);

        // Write file to disk
        const arrayBuffer = await file.arrayBuffer();
        await fs.writeFile(filepath, Buffer.from(arrayBuffer));

        // Return the URL for embedding in markdown
        const imageUrl = `/api/uploads/notes/${filename}`;

        return { url: imageUrl };
    }, {
        body: t.Object({
            image: t.Any() // File type
        })
    });
