import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import sql from '../db';
import bcrypt from 'bcryptjs';

// Duración del token: 2 horas en segundos
const TOKEN_EXPIRATION = 2 * 60 * 60;

export const authRoutes = new Elysia({ prefix: '/auth' })
    .use(
        jwt({
            name: 'jwt',
            secret: process.env.JWT_SECRET || 'changeme_in_prod',
            exp: '2h' // Token expira en 2 horas
        })
    )
    .post('/register', async ({ body, set, jwt }) => {
        // @ts-ignore
        const { email, password, fullName } = body;

        // Check if user exists
        const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
        if (existing.length > 0) {
            set.status = 400;
            return { error: 'User already exists' };
        }

        // Determinar si es el primer usuario (será admin)
        const userCount = await sql`SELECT COUNT(*) as count FROM users`;
        const isFirstUser = parseInt(userCount[0].count) === 0;
        const role = isFirstUser ? 'admin' : 'user';

        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user con rol
        const [user] = await sql`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES (${email}, ${hashedPassword}, ${fullName}, ${role})
      RETURNING id, email, full_name, role
    `;

        // Auto-create default portfolio
        await sql`
      INSERT INTO portfolios (user_id, name, is_public)
      VALUES (${user.id}, 'Portafolio Principal', false)
    `;

        // Generate JWT con expiración y rol
        const token = await jwt.sign({
            sub: user.id,
            email: user.email,
            role: user.role
        });

        console.log(`User registered: ${user.email} with role: ${user.role}`);

        return {
            token,
            user: { id: user.id, email: user.email, name: user.full_name, role: user.role }
        };
    }, {
        body: t.Object({
            email: t.String(),
            password: t.String(),
            fullName: t.String()
        })
    })
    .post('/login', async ({ body, set, jwt }) => {
        // @ts-ignore
        const { email, password } = body;

        const users = await sql`SELECT * FROM users WHERE email = ${email}`;
        if (users.length === 0) {
            set.status = 401;
            return { error: 'Invalid credentials' };
        }

        const user = users[0];

        // Verificar si el usuario está bloqueado
        if (user.is_blocked) {
            set.status = 403;
            return { error: 'Tu cuenta ha sido bloqueada. Contacta con el administrador.' };
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            set.status = 401;
            return { error: 'Invalid credentials' };
        }

        // Generate JWT con expiración y rol
        const token = await jwt.sign({
            sub: user.id,
            email: user.email,
            role: user.role || 'user'
        });

        console.log('User logged in:', user.id, user.email, 'role:', user.role);

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.full_name,
                currency: user.preferred_currency,
                role: user.role || 'user'
            }
        };
    }, {
        body: t.Object({
            email: t.String(),
            password: t.String()
        })
    })
    .post('/forgot-password', async ({ body, set }) => {
        // @ts-ignore
        const { email } = body;

        const users = await sql`SELECT id, full_name FROM users WHERE email = ${email}`;

        if (users.length > 0) {
            const user = users[0];
            // Generar password de 10 caracteres (letras y números)
            const newPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-4).toUpperCase();

            // Hashear
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Actualizar DB
            await sql`UPDATE users SET password_hash = ${hashedPassword} WHERE id = ${user.id}`;

            // Enviar Email
            // Import dinámico para evitar error si no se ha regenerado el bundle aún o issue con imports circulares, aunque no debería.
            // Mejor import arriba si pudiera, pero replace no me deja fácil editar arriba. 
            // Usaré require o import si puedo, pero `EmailService` es ts. 
            // Asumiré que puedo añadir el import arriba.

            const { EmailService } = await import('../services/emailService');

            const emailHtml = `
                <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #2563eb;">Stocks Manager - Recuperación</h2>
                    <p>Hola <strong>${user.full_name || 'Usuario'}</strong>,</p>
                    <p>Hemos recibido una solicitud para restablecer tu contraseña.</p>
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
                        <p style="margin: 0; font-size: 14px; color: #666;">Tu nueva contraseña temporal es:</p>
                        <p style="margin: 10px 0; font-size: 24px; font-weight: bold; color: #111; letter-spacing: 2px;">${newPassword}</p>
                    </div>
                    <p>Por favor, inicia sesión y cambia esta contraseña lo antes posible desde tu perfil.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 12px; color: #999;">Si no has solicitado esto, contacta con el administrador.</p>
                </div>
            `;

            const sent = await EmailService.sendEmail(email, 'Restablecimiento de Contraseña', emailHtml);

            if (!sent) {
                set.status = 500;
                return { error: 'Error al enviar el correo. Verifica la configuración SMTP del servidor.' };
            }
        } else {
            // Retardo artificial para evitar user enumeration timing attack
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return { success: true, message: 'Si el correo está registrado, recibirás una nueva contraseña en breve.' };
    }, {
        body: t.Object({
            email: t.String()
        })
    })
    .post('/change-password', async ({ headers, body, set, jwt }) => {
        // 1. Auth Check Manual
        const auth = headers['authorization'];
        if (!auth?.startsWith('Bearer ')) {
            set.status = 401;
            throw new Error('Unauthorized');
        }
        const token = auth.slice(7);
        const profile = await jwt.verify(token) as any;

        if (!profile || !profile.sub) {
            set.status = 401;
            throw new Error('Unauthorized');
        }

        const userId = profile.sub;
        const { currentPassword, newPassword } = body as any;

        if (!currentPassword || !newPassword) {
            set.status = 400;
            return { error: 'Faltan campos requeridos' };
        }

        if (newPassword.length < 6) {
            set.status = 400;
            return { error: 'La nueva contraseña debe tener al menos 6 caracteres' };
        }

        // 2. Verificar contraseña actual
        const user = await sql`SELECT password_hash FROM users WHERE id = ${userId}`;
        if (user.length === 0) {
            set.status = 404;
            return { error: 'Usuario no encontrado' };
        }

        const valid = await bcrypt.compare(currentPassword, user[0].password_hash);
        if (!valid) {
            set.status = 400;
            return { error: 'La contraseña actual es incorrecta' };
        }

        // 3. Hashear y actualizar
        const hashed = await bcrypt.hash(newPassword, 10);
        await sql`UPDATE users SET password_hash = ${hashed} WHERE id = ${userId}`;

        console.log(`User ${userId} changed password`);
        return { success: true, message: 'Contraseña actualizada correctamente' };
    });

