import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import sql from '../db';
import bcrypt from 'bcryptjs';
import { SettingsService } from '../services/settingsService';
import { MarketDataService } from '../services/marketData';
import { AIService } from '../services/aiService';
import nodemailer from 'nodemailer';

export const adminRoutes = new Elysia({ prefix: '/admin' })
    .use(
        jwt({
            name: 'jwt',
            secret: process.env.JWT_SECRET || 'changeme_in_prod'
        })
    )
    // Middleware para verificar que el usuario es admin
    .derive(async ({ jwt, headers, set }) => {
        const auth = headers['authorization'];
        if (!auth?.startsWith('Bearer ')) {
            set.status = 401;
            throw new Error('Unauthorized');
        }
        const token = auth.slice(7);
        const profile = await jwt.verify(token) as { sub?: string; role?: string } | false;

        if (!profile || !profile.sub) {
            set.status = 401;
            throw new Error('Unauthorized');
        }

        // Verificar rol admin en la base de datos
        const [user] = await sql`SELECT id, role FROM users WHERE id = ${profile.sub}`;
        if (!user || user.role !== 'admin') {
            set.status = 403;
            throw new Error('Forbidden: Admin access required');
        }

        return { userId: profile.sub, userRole: 'admin' };
    })

    // Sincronización Manual de Mercado
    .post('/market/sync', async ({ body }) => {
        // @ts-ignore
        const { months, type } = body;
        try {
            const m = Number(months) || 1;

            if (type === 'portfolio' || type === 'all') {
                MarketDataService.syncPortfolioHistory(m).catch(e => console.error('Manual Portfolio Sync Error:', e));
            }
            if (type === 'currencies' || type === 'all') {
                MarketDataService.syncCurrencyHistory(m).catch(e => console.error('Manual Currency Sync Error:', e));
            }

            return {
                success: true,
                message: `Sincronización iniciada (${type}) para los últimos ${m} meses.`
            };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }, {
        body: t.Object({
            months: t.Numeric(),
            type: t.String()
        })
    })

    // Listar todos los usuarios
    .get('/users', async () => {
        const users = await sql`
            SELECT id, email, full_name, role, is_blocked, created_at, updated_at
            FROM users
            ORDER BY created_at DESC
        `;
        return users.map(u => ({
            id: u.id,
            email: u.email,
            name: u.full_name,
            role: u.role || 'user',
            isBlocked: u.is_blocked || false,
            createdAt: u.created_at
        }));
    })
    // Bloquear/Desbloquear usuario
    .put('/users/:userId/block', async ({ params, body }) => {
        const { userId } = params;
        // @ts-ignore
        const { blocked } = body;

        const [user] = await sql`SELECT role FROM users WHERE id = ${userId}`;
        if (!user) {
            throw new Error('User not found');
        }

        await sql`
            UPDATE users SET is_blocked = ${blocked}, updated_at = NOW()
            WHERE id = ${userId}
        `;

        console.log(`User ${userId} ${blocked ? 'blocked' : 'unblocked'}`);
        return { success: true, message: blocked ? 'Usuario bloqueado' : 'Usuario desbloqueado' };
    }, {
        body: t.Object({
            blocked: t.Boolean()
        })
    })
    // Cambiar rol de usuario
    .put('/users/:userId/role', async ({ params, body, userId: adminId }) => {
        const { userId } = params;
        // @ts-ignore
        const { role } = body;

        if (role !== 'admin' && role !== 'user') {
            throw new Error('Invalid role');
        }

        if (userId === adminId && role !== 'admin') {
            throw new Error('No puedes quitarte el rol de admin a ti mismo');
        }

        await sql`
            UPDATE users SET role = ${role}, updated_at = NOW()
            WHERE id = ${userId}
        `;

        console.log(`User ${userId} role changed to ${role}`);
        return { success: true, message: `Rol cambiado a ${role}` };
    }, {
        body: t.Object({
            role: t.String()
        })
    })
    // Cambiar contraseña de usuario
    .put('/users/:userId/password', async ({ params, body }) => {
        const { userId } = params;
        // @ts-ignore
        const { newPassword } = body;

        if (!newPassword || newPassword.length < 6) {
            throw new Error('La contraseña debe tener al menos 6 caracteres');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await sql`
            UPDATE users SET password_hash = ${hashedPassword}, updated_at = NOW()
            WHERE id = ${userId}
        `;

        console.log(`Password changed for user ${userId}`);
        return { success: true, message: 'Contraseña actualizada' };
    }, {
        body: t.Object({
            newPassword: t.String()
        })
    })
    // Eliminar usuario
    .delete('/users/:userId', async ({ params, userId: adminId }) => {
        const { userId } = params;

        if (userId === adminId) {
            throw new Error('No puedes eliminar tu propia cuenta');
        }

        await sql`DELETE FROM users WHERE id = ${userId}`;

        console.log(`User ${userId} deleted`);
        return { success: true, message: 'Usuario eliminado' };
    })
    // Estadísticas
    .get('/stats', async () => {
        const [userStats] = await sql`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_blocked THEN 1 ELSE 0 END) as blocked
            FROM users
        `;
        const [portfolioStats] = await sql`SELECT COUNT(*) as total FROM portfolios`;
        const [positionStats] = await sql`SELECT COUNT(*) as total FROM positions`;
        const [transactionStats] = await sql`SELECT COUNT(*) as total FROM transactions`;

        return {
            users: {
                total: parseInt(userStats.total),
                blocked: parseInt(userStats.blocked || '0')
            },
            portfolios: parseInt(portfolioStats.total),
            positions: parseInt(positionStats.total),
            transactions: parseInt(transactionStats.total)
        };
    })
    // === SETTINGS (Base de Datos) ===

    // General Settings (App URL)
    .get('/settings/general', async () => {
        return {
            appUrl: await SettingsService.get('APP_URL') || ''
        };
    })
    .post('/settings/general', async ({ body }) => {
        // @ts-ignore
        const { appUrl } = body;
        try {
            await SettingsService.set('APP_URL', appUrl);
            return { success: true, message: 'URL de la aplicación actualizada correctamente.' };
        } catch (error: any) {
            console.error('Error saving general settings:', error);
            throw new Error(`Error al guardar: ${error.message}`);
        }
    }, {
        body: t.Object({
            appUrl: t.String()
        })
    })

    // API Keys
    .get('/settings/api', async () => {
        return await SettingsService.getApiKeys();
    })
    .post('/settings/api', async ({ body }) => {
        // @ts-ignore
        const { finnhub, google } = body;
        try {
            await SettingsService.set('FINNHUB_API_KEY', finnhub, true);
            await SettingsService.set('GOOGLE_GENAI_API_KEY', google, true);

            // Actualizar process.env para compatibilidad inmediata
            process.env.FINNHUB_API_KEY = finnhub;
            process.env.GOOGLE_GENAI_API_KEY = google;

            return { success: true, message: 'Claves API guardadas correctamente' };
        } catch (error: any) {
            console.error('Error saving API keys:', error);
            throw new Error(`Error al guardar: ${error.message}`);
        }
    }, {
        body: t.Object({
            finnhub: t.String(),
            google: t.String()
        })
    })

    // === AI SETTINGS ===
    .get('/settings/ai', async () => {
        const model = await SettingsService.get('AI_MODEL') || 'gemini-1.5-flash';
        return { model };
    })
    .get('/settings/ai/models', async () => {
        return await AIService.getAvailableModels();
    })
    .post('/settings/ai/models/refresh', async () => {
        try {
            const models = await AIService.fetchAvailableModels();
            return { success: true, models, message: 'Lista de modelos actualizada correctamente desde Google' };
        } catch (e: any) {
            throw new Error(e.message);
        }
    })
    .post('/settings/ai', async ({ body }) => {
        // @ts-ignore
        const { model } = body;
        await SettingsService.set('AI_MODEL', model, false);
        process.env.AI_MODEL = model;
        return { success: true, message: 'Modelo de IA actualizado correctamente' };
    }, {
        body: t.Object({
            model: t.String()
        })
    })
    // Prompts
    .get('/settings/ai/prompts', async () => {
        const chat = await SettingsService.get('AI_PROMPT_CHATBOT') || '';
        const analysis = await SettingsService.get('AI_PROMPT_ANALYSIS') || '';
        return { chat, analysis };
    })
    .post('/settings/ai/prompts', async ({ body }) => {
        // @ts-ignore
        const { chat, analysis } = body;
        await SettingsService.set('AI_PROMPT_CHATBOT', chat, false);
        await SettingsService.set('AI_PROMPT_ANALYSIS', analysis, false);
        return { success: true, message: 'Prompts de IA actualizados correctamente' };
    }, {
        body: t.Object({
            chat: t.String(),
            analysis: t.String()
        })
    })

    // SMTP Config
    .get('/settings/smtp', async () => {
        const config = await SettingsService.getSmtpConfig();
        return {
            ...config,
            password: config.password ? '••••••••' : ''
        };
    })
    .post('/settings/smtp', async ({ body }) => {
        // @ts-ignore
        const { host, port, user, password, from } = body;

        try {
            await SettingsService.set('SMTP_HOST', host);
            await SettingsService.set('SMTP_PORT', port);
            await SettingsService.set('SMTP_USER', user);

            if (password && password !== '••••••••') {
                await SettingsService.set('SMTP_PASSWORD', password, true); // Encriptado
            }

            await SettingsService.set('SMTP_FROM', from);

            // Actualizar process.env
            process.env.SMTP_HOST = host;
            process.env.SMTP_PORT = port;
            process.env.SMTP_USER = user;
            process.env.SMTP_FROM = from;

            console.log("SMTP settings updated in DB");
            return { success: true, message: 'Configuración SMTP guardada correctamente en base de datos' };
        } catch (error: any) {
            console.error('Error saving SMTP settings:', error);
            throw new Error(`Error al guardar: ${error.message}`);
        }
    }, {
        body: t.Object({
            host: t.String(),
            port: t.String(),
            user: t.String(),
            password: t.String(),
            from: t.String()
        })
    })

    // Test SMTP
    .post('/settings/smtp/test', async ({ body }) => {
        // @ts-ignore
        const { testEmail } = body;
        try {
            const config = await SettingsService.getSmtpConfig();

            if (!config.host || !config.user || !config.password) {
                throw new Error('Faltan datos de configuración SMTP');
            }

            const transporter = nodemailer.createTransport({
                host: config.host,
                port: parseInt(config.port),
                secure: parseInt(config.port) === 465,
                auth: {
                    user: config.user,
                    pass: config.password
                }
            });

            await transporter.sendMail({
                from: config.from || config.user,
                to: testEmail,
                subject: 'Prueba SMTP - Stocks Manager',
                text: 'Prueba de configuración SMTP exitosa.',
                html: '<h3>Stocks Manager</h3><p>✅ Configuración SMTP correcta.</p>'
            });

            return { success: true, message: `Email de prueba enviado a ${testEmail}` };
        } catch (error: any) {
            console.error('SMTP test failed:', error);
            throw new Error(`Error al enviar email: ${error.message}`);
        }
    }, {
        body: t.Object({
            testEmail: t.String()
        })
    })

    // ===== BACKUP & RESTORE =====
    .get('/backup/tables', async () => {
        const tables = await sql`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `;
        return tables.map(t => t.table_name);
    })
    .get('/backup/json', async () => {
        try {
            const tablesResult = await sql`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
                ORDER BY table_name
            `;
            const tableNames = tablesResult.map(t => t.table_name);

            const backup: Record<string, any[]> = {};
            const metadata = {
                version: '1.0',
                createdAt: new Date().toISOString(),
                tables: tableNames
            };

            for (const tableName of tableNames) {
                const rows = await sql.unsafe(`SELECT * FROM "${tableName}"`);
                backup[tableName] = rows;
            }

            console.log(`Backup JSON created with ${tableNames.length} tables`);
            return { metadata, data: backup };
        } catch (error: any) {
            console.error('Backup JSON failed:', error);
            throw new Error(`Error al crear backup: ${error.message}`);
        }
    })
    .get('/backup/sql', async ({ set }) => {
        try {
            const tablesResult = await sql`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
                ORDER BY table_name
            `;
            const tableNames = tablesResult.map(t => t.table_name);

            let sqlScript = `-- Stocks Manager Backup\n-- Generated: ${new Date().toISOString()}\n-- Tables: ${tableNames.join(', ')}\n\n`;

            sqlScript += `BEGIN;\n`;
            // Attempt to set session_replication_role only if possible
            sqlScript += `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND rolsuper = true) THEN EXECUTE 'SET session_replication_role = replica'; END IF; END $$;\n\n`;

            for (const tableName of tableNames) {
                const rows = await sql.unsafe(`SELECT * FROM "${tableName}"`);

                if (rows.length > 0) {
                    sqlScript += `-- Table: ${tableName}\n`;
                    // Use TRUNCATE CASCADE for better cleanup
                    sqlScript += `TRUNCATE TABLE "${tableName}" CASCADE;\n`;

                    for (const row of rows) {
                        const cols = Object.keys(row);
                        const vals = Object.values(row).map(v => {
                            if (v === null) return 'NULL';
                            if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
                            if (typeof v === 'number') return v.toString();
                            if (v instanceof Date) return `'${v.toISOString()}'`;
                            if (typeof v === 'object') {
                                // Handle Arrays and Objects (JSON)
                                return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
                            }
                            // Escape single quotes properly
                            // @ts-ignore
                            return `'${String(v).replace(/'/g, "''")}'`;
                        });
                        sqlScript += `INSERT INTO "${tableName}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${vals.join(', ')});\n`;
                    }
                    sqlScript += `\n`;
                }
            }
            // Restore session role
            sqlScript += `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND rolsuper = true) THEN EXECUTE 'SET session_replication_role = DEFAULT'; END IF; END $$;\n`;
            sqlScript += `COMMIT;\n`;

            set.headers['Content-Type'] = 'text/plain';
            return sqlScript;
        } catch (error: any) {
            console.error('Backup SQL failed:', error);
            throw new Error(`Error al crear backup SQL: ${error.message}`);
        }
    })
    .post('/backup/restore', async ({ body }) => {
        // @ts-ignore
        const { metadata, data } = body;

        if (!metadata || !data) {
            throw new Error('Formato de backup inválido');
        }

        try {
            console.log(`Starting restore from backup created at ${metadata.createdAt}`);

            // Update order: users -> portfolios -> watchlists -> positions -> transactions
            // This order is safer for insertion if FK checks cannot be disabled
            const tableOrder = ['users', 'portfolios', 'watchlists', 'positions', 'transactions'];
            const allTables = Object.keys(data);
            const orderedTables = [
                ...tableOrder.filter(t => allTables.includes(t)),
                ...allTables.filter(t => !tableOrder.includes(t))
            ];

            // Try to set replication role (ignore error if not superuser)
            try {
                await sql.unsafe('SET session_replication_role = replica;');
            } catch (e) {
                console.warn('Could not set session_replication_role (probably not superuser).');
            }

            for (const tableName of orderedTables) {
                const rows = data[tableName];
                if (!rows || !Array.isArray(rows)) continue;

                const tableExists = await sql`
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_name = ${tableName}
                `;
                if (tableExists.length === 0) continue;

                await sql.unsafe(`TRUNCATE TABLE "${tableName}" CASCADE`);

                for (const row of rows) {
                    const cols = Object.keys(row);
                    const placeholders = cols.map((_, i) => `$${i + 1}`);
                    const values = Object.values(row);

                    try {
                        await sql.unsafe(
                            `INSERT INTO "${tableName}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')})`,
                            // @ts-ignore
                            values
                        );
                    } catch (insertError: any) {
                        console.warn(`Warning inserting into ${tableName}:`, insertError.message);
                    }
                }
            }

            try {
                await sql.unsafe('SET session_replication_role = DEFAULT;');
            } catch (e) { }

            return {
                success: true,
                message: `Base de datos restaurada. ${orderedTables.length} tablas procesadas.`,
                tablesRestored: orderedTables
            };
        } catch (error: any) {
            try { await sql.unsafe('SET session_replication_role = DEFAULT;'); } catch (e) { }
            console.error('Restore failed:', error);
            throw new Error(`Error al restaurar: ${error.message}`);
        }
    }, {
        body: t.Object({
            metadata: t.Object({
                version: t.String(),
                createdAt: t.String(),
                tables: t.Array(t.String())
            }),
            data: t.Record(t.String(), t.Array(t.Any()))
        })
    })
    .post('/backup/restore-sql', async ({ body }) => {
        // @ts-ignore
        const { sqlScript } = body;

        if (!sqlScript || typeof sqlScript !== 'string') {
            throw new Error('Script SQL inválido');
        }

        try {
            console.log('Starting SQL restore...');

            try {
                await sql.unsafe('SET session_replication_role = replica;');
            } catch (e) {
                console.warn('Could not set session_replication_role (needs superuser). SQL script might fail if not ordered.');
            }

            const statements = sqlScript
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith('--'));

            let executed = 0;
            let errors = 0;

            for (const statement of statements) {
                if (statement.match(/^(BEGIN|COMMIT|ROLLBACK)/i)) continue;
                // Ignore specific DO blocks if they fail, or let them run. 
                // We'll let them run as sql.unsafe(statement)

                try {
                    await sql.unsafe(statement);
                    executed++;
                } catch (err: any) {
                    // Ignore errors related to session_replication_role if embedded in script
                    if (statement.includes('session_replication_role')) continue;

                    console.warn(`SQL statement failed: ${err.message}`);
                    errors++;
                }
            }

            try {
                await sql.unsafe('SET session_replication_role = DEFAULT;');
            } catch (e) { }

            return {
                success: true,
                message: `Restauración completada. ${executed} sentencias ejecutadas${errors > 0 ? `, ${errors} errores` : ''}.`
            };
        } catch (error: any) {
            try { await sql.unsafe('SET session_replication_role = DEFAULT;'); } catch (e) { }
            console.error('SQL restore failed:', error);
            throw new Error(`Error al restaurar SQL: ${error.message}`);
        }
    }, {
        body: t.Object({
            sqlScript: t.String()
        })
    });
