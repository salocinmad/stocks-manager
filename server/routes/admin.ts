import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import sql from '../db';
import bcrypt from 'bcryptjs';
import { SettingsService } from '../services/settingsService';
import { MarketDataService } from '../services/marketData';
import { AIService } from '../services/aiService';
import AdmZip from 'adm-zip';
import * as fs from 'fs';
import * as path from 'path';
import nodemailer from 'nodemailer';

// Helper implementation for consistent table ordering
const getOrderedTables = (allTables: string[]) => {
    // Order: Independent -> Roots -> Dependents Level 1 -> Dependents Level 2
    const desiredOrder = [
        'system_settings',
        'historical_data',
        'users',                 // Root
        'financial_events',      // Dep: users
        'notification_channels', // Dep: users
        'watchlists',            // Dep: users
        'alerts',                // Dep: users
        'portfolios',            // Dep: users
        'positions',             // Dep: portfolios
        'transactions'           // Dep: portfolios
    ];

    // Return sorted tables: those in desiredOrder first, then the rest alphabetically
    return [
        ...desiredOrder.filter(t => allTables.includes(t)),
        ...allTables.filter(t => !desiredOrder.includes(t)).sort()
    ];
};

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
            SELECT id, email, full_name, role, is_blocked, two_factor_enabled, security_mode, created_at, updated_at
            FROM users
            ORDER BY created_at DESC
        `;
        return users.map(u => ({
            id: u.id,
            email: u.email,
            name: u.full_name,
            role: u.role || 'user',
            isBlocked: u.is_blocked || false,
            twoFactorEnabled: u.two_factor_enabled || false,
            securityMode: u.security_mode || 'standard',
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

        return { success: true, message: 'Usuario eliminado' };
    })
    // ===== 2FA ADMIN CONTROLS =====
    // Reset 2FA for a user
    .delete('/users/:userId/2fa', async ({ params }) => {
        const { userId } = params;

        await sql`
            UPDATE users 
            SET two_factor_enabled = FALSE,
                two_factor_secret = NULL,
                security_mode = 'standard',
                backup_codes = NULL,
                backup_codes_downloaded = FALSE,
                backup_codes_generated_at = NULL
            WHERE id = ${userId}
        `;

        return { success: true, message: '2FA desactivado para el usuario' };
    })
    // Reset security mode to standard
    .patch('/users/:userId/security-mode', async ({ params, body }) => {
        const { userId } = params;
        // @ts-ignore
        const { mode } = body;

        if (mode !== 'standard' && mode !== 'enhanced') {
            throw new Error('Modo inválido');
        }

        await sql`
            UPDATE users SET security_mode = ${mode} WHERE id = ${userId}
        `;

        return { success: true, message: `Modo de seguridad cambiado a ${mode}` };
    }, {
        body: t.Object({
            mode: t.String()
        })
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
            process.env.SMTP_USER = user;
            process.env.SMTP_FROM = from;

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
        const tablesResult = await sql`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        `;
        const allTables = tablesResult.map(t => t.table_name);
        return getOrderedTables(allTables);
    })
    // Backup JSON (Restaurado)
    .get('/backup/json', async () => {
        try {
            const tablesResult = await sql`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
            `;
            const allTables = tablesResult.map(t => t.table_name);
            const tableNames = getOrderedTables(allTables);

            const backupData: Record<string, any[]> = {};
            const metadata = {
                version: '1.0',
                createdAt: new Date().toISOString(),
                tables: tableNames
            };

            for (const tableName of tableNames) {
                const rows = await sql.unsafe(`SELECT * FROM "${tableName}"`);
                backupData[tableName] = rows;
            }

            console.log(`Backup JSON created with ${tableNames.length} tables`);
            return { metadata, data: backupData };
        } catch (error: any) {
            console.error('Backup JSON failed:', error);
            throw new Error(`Error al crear backup: ${error.message}`);
        }
    })
    // Modificado: Backup ahora devuelve un ZIP con el JSON t las imagenes
    .get('/backup/zip', async () => {
        try {
            // 1. Generar JSON con los datos de la DB
            const tablesResult = await sql`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
            `;
            const allTables = tablesResult.map(t => t.table_name);
            const tableNames = getOrderedTables(allTables);

            const backupData: Record<string, any[]> = {};
            const metadata = {
                version: '1.0',
                createdAt: new Date().toISOString(),
                tables: tableNames
            };

            for (const tableName of tableNames) {
                const rows = await sql.unsafe(`SELECT * FROM "${tableName}"`);
                backupData[tableName] = rows;
            }

            const backupJson = { metadata, data: backupData };

            // 2. Crear ZIP
            const zip = new AdmZip();

            // Añadir JSON al ZIP
            zip.addFile("database_dump.json", Buffer.from(JSON.stringify(backupJson, null, 2), "utf8"));

            // Añadir carpeta de uploads/notes al ZIP
            const uploadsNotesPath = path.join(process.cwd(), 'uploads', 'notes');
            if (fs.existsSync(uploadsNotesPath)) {
                zip.addLocalFolder(uploadsNotesPath, "uploads/notes");
            }

            // 3. Generar buffer
            const zipBuffer = zip.toBuffer();
            const fileName = `stocks-manager-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;



            return new Response(zipBuffer, {
                headers: {
                    'Content-Type': 'application/zip',
                    'Content-Disposition': `attachment; filename="${fileName}"`
                }
            });

        } catch (error: any) {
            console.error('Backup ZIP failed:', error);
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
            `;
            const allTables = tablesResult.map(t => t.table_name);
            const tableNames = getOrderedTables(allTables);

            let sqlScript = `-- Stocks Manager Backup\n-- Generated: ${new Date().toISOString()}\n-- Tables: ${tableNames.join(', ')}\n\n`;

            sqlScript += `BEGIN;\n`;
            // Attempt to set session_replication_role only if possible
            sqlScript += `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND rolsuper = true) THEN EXECUTE 'SET session_replication_role = replica'; END IF; END $$;\n\n`;

            for (const tableName of tableNames) {
                const rows = await sql.unsafe(`SELECT * FROM "${tableName}"`);

                // Always TRUNCATE to ensure clean state, even if table is empty in backup
                sqlScript += `-- Table: ${tableName}\n`;
                sqlScript += `TRUNCATE TABLE "${tableName}" CASCADE;\n`;

                if (rows.length > 0) {
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
    // Modificado: Restore ahora acepta ZIP o JSON (multipart/form-data)
    .post('/backup/restore', async ({ request }) => {
        try {
            const formData = await request.formData();
            const file = formData.get('file');

            if (!file || !(file instanceof Blob)) {
                throw new Error('Se requiere un archivo válido (ZIP o JSON)');
            }

            // Convertir Blob a Buffer
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            let metadata, data;
            let isZip = false;

            // Intentar detectar si es ZIP (pk signature) o JSON
            // ZIP magic number: PK.. (0x50 0x4B 0x03 0x04)
            if (buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
                isZip = true;
            }

            const zip = isZip ? new AdmZip(buffer) : null;
            const zipEntries = zip ? zip.getEntries() : [];

            if (isZip && zip) {
                // Modo ZIP
                const dumpEntry = zipEntries.find(entry => entry.entryName === 'database_dump.json');
                if (!dumpEntry) {
                    throw new Error('El archivo ZIP no contiene database_dump.json');
                }
                const dumpContent = dumpEntry.getData().toString('utf8');
                const parsed = JSON.parse(dumpContent);
                metadata = parsed.metadata;
                data = parsed.data;
            } else {
                // Modo JSON (asumimos que es texto plano JSON)
                try {
                    const content = buffer.toString('utf8');
                    const parsed = JSON.parse(content);
                    metadata = parsed.metadata;
                    data = parsed.data;
                } catch (e) {
                    throw new Error('El archivo no es un JSON válido ni un ZIP válido.');
                }
            }

            if (!metadata || !data) {
                throw new Error('Estructura de backup inválida (faltan metadatos o datos)');
            }

            console.log(`Starting restore from backup created at ${metadata.createdAt}`);

            // 1. Get ALL current tables in the DB to ensure we wipe everything
            const currentTablesResult = await sql`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
            `;
            const currentTables = currentTablesResult.map(t => t.table_name);
            // Sort them for safe deletion (Users first -> cascades)
            const tablesToTruncate = getOrderedTables(currentTables);

            // 2. Truncate ALL tables
            for (const tableName of tablesToTruncate) {
                try {
                    await sql.unsafe(`TRUNCATE TABLE "${tableName}" CASCADE`);
                } catch (e: any) {
                    console.warn(`Could not truncate ${tableName}: ${e.message}`);
                }
            }

            // 3. Restore Data
            // We iterate over the BACKUP's tables, but we respect dependency order for insertion
            const backupTables = Object.keys(data);
            const tablesToRestore = getOrderedTables(backupTables);

            // Insert data in order (parents first)
            for (const tableName of tablesToRestore) {
                const rows = data[tableName];
                if (rows && rows.length > 0) {
                    console.log(`Restoring ${tableName}: ${rows.length} rows`);
                    // Insert in chunks to avoid query size limits
                    const chunkSize = 1000;
                    for (let i = 0; i < rows.length; i += chunkSize) {
                        const chunk = rows.slice(i, i + chunkSize);

                        // We must ensure columns match exactly what's in the rows
                        // Since we are restoring, we can assume all rows in a table have the same structure (from backup)
                        if (chunk.length > 0) {
                            const columns = Object.keys(chunk[0]);
                            await sql`
                                INSERT INTO ${sql(tableName)} ${sql(chunk, columns)}
                            `;
                        }
                    }
                }
            }

            // 2. Extraer imágenes (SOLO SI ES ZIP)
            if (isZip && zip) {
                // El ZIP contiene "uploads/notes/..." como estructura de carpetas.
                // Al extraer en process.cwd() (/app), se colocarán en /app/uploads/notes/...
                // database_dump.json también se extraerá en /app, pero no molesta.
                console.log(`Extracting ZIP contents to ${process.cwd()}...`);
                try {
                    zip.extractAllTo(process.cwd(), true);
                    console.log('Images restored successfully');
                } catch (e: any) {
                    console.error('Error extracting ZIP images:', e);
                }
            }
            console.log('Restore completed successfully');
            try {
                await sql.unsafe('SET session_replication_role = DEFAULT;');
            } catch (e) { }

            return { success: true, message: 'Restauración completada con éxito' };

        } catch (error: any) {
            console.error('Restore failed:', error);
            throw new Error(`Error en la restauración: ${error.message}`);
        }
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

            // --- FORCE WIPE BEFORE RESTORE (Safe Mode) ---
            // Just like JSON restore, we ensure the DB is clean before running the script.
            // This fixes issues where the script might not contain TRUNCATEs for empty tables from the source.
            try {
                const currentTablesResult = await sql`
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_type = 'BASE TABLE'
                `;
                const currentTables = currentTablesResult.map(t => t.table_name);
                const tablesToTruncate = getOrderedTables(currentTables);

                for (const tableName of tablesToTruncate) {
                    await sql.unsafe(`TRUNCATE TABLE "${tableName}" CASCADE`);
                }
                console.log('Pre-restore wipe completed for SQL mode.');
            } catch (wipeError: any) {
                console.error('Warning: Pre-restore wipe failed:', wipeError.message);
                // We continue, hoping the script handles it or it's non-fatal
            }
            // ---------------------------------------------

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
