import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import sql from '../db';
import { promises as fs } from 'fs';
import path from 'path';

const AVATARS_DIR = path.join(process.cwd(), 'uploads', 'avatars');

// Ensure avatars directory exists
fs.mkdir(AVATARS_DIR, { recursive: true }).catch(console.error);

export const userRoutes = new Elysia({ prefix: '/user' })
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
        const profile = await jwt.verify(auth.slice(7)) as any;
        if (!profile?.sub) {
            set.status = 401;
            throw new Error('Unauthorized');
        }
        return { userId: profile.sub };
    })
    .get('/profile', async ({ userId, set }) => {
        try {
            const [user] = await sql`
                SELECT id, full_name, email, avatar_url, role, preferred_currency 
                FROM users 
                WHERE id = ${userId}
            `;

            if (!user) {
                set.status = 404;
                return { error: 'Usuario no encontrado' };
            }

            return { success: true, user };
        } catch (error) {
            console.error('Error fetching profile:', error);
            set.status = 500;
            return { error: 'Error al obtener perfil' };
        }
    })
    .put('/profile', async ({ body, userId, set }) => {
        const { fullName, email } = body as any;

        // Validar si el email ya existe en otro usuario
        if (email) {
            const existing = await sql`SELECT id FROM users WHERE email = ${email} AND id != ${userId}`;
            if (existing.length > 0) {
                set.status = 400;
                return { error: 'El email ya está en uso' };
            }
        }

        try {
            const [updatedUser] = await sql`
                UPDATE users 
                SET 
                    full_name = COALESCE(${fullName}, full_name),
                    email = COALESCE(${email}, email),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${userId}
                RETURNING id, full_name, email, avatar_url, role, preferred_currency
            `;

            return { success: true, user: updatedUser };
        } catch (error) {
            console.error('Error updating profile:', error);
            set.status = 500;
            return { error: 'Error al actualizar el perfil' };
        }
    }, {
        body: t.Object({
            fullName: t.Optional(t.String()),
            email: t.Optional(t.String())
        })
    })
    .post('/avatar', async ({ body, userId, set }) => {
        // @ts-ignore
        const file = body.avatar;

        if (!file) {
            set.status = 400;
            return { error: 'No se envió ninguna imagen' };
        }

        // Generate unique filename: userId_timestamp.ext
        const ext = file.name?.split('.').pop() || 'png';
        const filename = `${userId}_${Date.now()}.${ext}`;
        const filepath = path.join(AVATARS_DIR, filename);
        // Define avatarUrl before using it
        const avatarUrl = `/api/uploads/avatars/${filename}`;

        try {
            // 1. Write new file to disk FIRST
            const arrayBuffer = await file.arrayBuffer();
            await fs.writeFile(filepath, Buffer.from(arrayBuffer));

            // 2. Fetch current info (to know what to delete later)
            const [currentUser] = await sql`SELECT avatar_url FROM users WHERE id = ${userId}`;

            // 3. Update user in DB
            const [updatedUser] = await sql`
                UPDATE users 
                SET avatar_url = ${avatarUrl}, updated_at = CURRENT_TIMESTAMP
                WHERE id = ${userId}
                RETURNING id, full_name, email, avatar_url, role, preferred_currency
            `;

            // 4. If we reached here, DB update was successful. NOW safely delete the old file.
            if (currentUser?.avatar_url) {
                const oldUrl = currentUser.avatar_url;
                if (oldUrl.startsWith('/api/uploads/avatars/') && oldUrl !== avatarUrl) {
                    const oldFilename = oldUrl.split('/').pop();
                    if (oldFilename) {
                        const oldFilepath = path.join(AVATARS_DIR, oldFilename);
                        await fs.unlink(oldFilepath).catch(err => console.error('Error deleting old avatar:', err));
                    }
                }
            }

            return { success: true, avatarUrl, user: updatedUser };
        } catch (error) {
            console.error('Error uploading avatar:', error);
            // Cleanup: Delete the NEW file if something failed
            await fs.unlink(filepath).catch(() => { });

            set.status = 500;
            return { error: 'Error al subir la imagen' };
        }
    }, {
        body: t.Object({
            avatar: t.Any()
        })
    });
