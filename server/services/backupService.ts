import sql from '../db';
import archiver from 'archiver';
import * as fs from 'fs';
import * as path from 'path';

// Register the archiver-zip-encrypted plugin
// @ts-ignore
import archiverZipEncrypted from 'archiver-zip-encrypted';
archiver.registerFormat('zip-encrypted', archiverZipEncrypted);

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

    return [
        ...desiredOrder.filter(t => allTables.includes(t)),
        ...allTables.filter(t => !desiredOrder.includes(t)).sort()
    ];
};

export const BackupService = {
    // Generate Full Backup (JSON + Uploads) Streaming to Disk
    // Returns path to temporary ZIP file
    generateBackupZip: async (password?: string): Promise<string> => {
        return new Promise(async (resolve, reject) => {
            let output: fs.WriteStream | null = null;
            let tempFilePath = '';

            try {
                const tempDir = path.join(process.cwd(), 'temp');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }

                tempFilePath = path.join(tempDir, `backup-${Date.now()}.zip`);
                output = fs.createWriteStream(tempFilePath);

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
                    // Use cursor or smaller chunks if tables are huge, but for now full select is okay-ish 
                    // as long as JSON stringify doesn't blow up. 
                    // Ideally we should stream JSON too, but let's fix the ZIP buffering first which is the main culprit (images).
                    const rows = await sql.unsafe(`SELECT * FROM "${tableName}"`);
                    backupData[tableName] = rows;
                }

                const backupJson = JSON.stringify({ metadata, data: backupData }, null, 2);

                // 2. Crear ZIP con Archiver
                let archive: archiver.Archiver;

                if (password) {
                    // @ts-ignore
                    archive = archiver('zip-encrypted', {
                        zlib: { level: 1 }, // CPU Optimization: Fast compression
                        encryptionMethod: 'aes256',
                        password: password
                    });
                } else {
                    archive = archiver('zip', {
                        zlib: { level: 1 } // CPU Optimization: Fast compression
                    });
                }

                // Pipe archive data to the file
                archive.pipe(output);

                output.on('close', () => {
                    console.log(`[BackupService] Archive created: ${archive.pointer()} total bytes`);
                    resolve(tempFilePath);
                });

                archive.on('error', (err) => {
                    reject(err);
                });

                // Añadir JSON al ZIP
                archive.append(backupJson, { name: 'database_dump.json' });

                // Añadir carpeta uploads completa al ZIP
                const uploadsPath = path.join(process.cwd(), 'uploads');
                if (fs.existsSync(uploadsPath)) {
                    archive.directory(uploadsPath, 'uploads');
                }

                // Finalizar archivo
                await archive.finalize();

            } catch (error: any) {
                console.error('Error generating backup ZIP:', error);
                // Try cleanup if failed
                if (output) output.close();
                if (tempFilePath && fs.existsSync(tempFilePath)) {
                    try { fs.unlinkSync(tempFilePath); } catch (e) { }
                }
                reject(new Error(`Error generando backup: ${error.message}`));
            }
        });
    },

    getTables: async () => {
        const tablesResult = await sql`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        `;
        const allTables = tablesResult.map(t => t.table_name);
        return getOrderedTables(allTables);
    }
};
