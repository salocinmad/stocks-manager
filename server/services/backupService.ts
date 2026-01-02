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
    // Generate Full Backup (JSON + Uploads) in Buffer (ZIP)
    // Supports optional password encryption (AES-256 via archiver-zip-encrypted)
    generateBackupZip: async (password?: string): Promise<Buffer> => {
        return new Promise(async (resolve, reject) => {
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

                const backupJson = JSON.stringify({ metadata, data: backupData }, null, 2);

                // 2. Crear ZIP con Archiver
                // Configurar opciones de archivo
                let archive: archiver.Archiver;

                if (password) {
                    // @ts-ignore - registerFormat is triggered by import, allowing 'zip-encrypted'
                    archive = archiver('zip-encrypted', {
                        zlib: { level: 9 },
                        encryptionMethod: 'aes256',
                        password: password
                    });
                } else {
                    archive = archiver('zip', {
                        zlib: { level: 9 }
                    });
                }

                // Buffer para almacenar el ZIP en memoria
                const buffers: Buffer[] = [];

                archive.on('data', (data) => {
                    buffers.push(data);
                });

                archive.on('error', (err) => {
                    reject(err);
                });

                archive.on('end', () => {
                    const finalBuffer = Buffer.concat(buffers);
                    resolve(finalBuffer);
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
