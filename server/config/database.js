import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../drizzle/schema.js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// Cargar credenciales desde /run/secrets si existen
const dbCredentialsPath = '/run/secrets/db_credentials';
if (fs.existsSync(dbCredentialsPath)) {
  dotenv.config({ path: dbCredentialsPath });
}

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || process.env.POSTGRES_DB || 'portfolio_manager',
  user: process.env.DB_USER || process.env.POSTGRES_USER || 'user',
  password: process.env.DB_PASS || process.env.POSTGRES_PASSWORD || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const db = drizzle(pool, { schema });

export const connectDB = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1'); // Test connection
    client.release();
    console.log('✅ Conectado a PostgreSQL correctamente');
    // Drizzle migrations se ejecutan en Docker entrypoint o manualmente
    console.log('✅ Schema Drizzle listo (migrations pendientes)');
  } catch (error) {
    console.error('❌ Error al conectar con PostgreSQL:', error);
    process.exit(1);
  }
};

export default { db, connectDB, pool };
