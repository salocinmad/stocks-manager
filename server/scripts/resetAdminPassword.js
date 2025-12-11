import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';
import bcrypt from 'bcryptjs';
import { db, pool, connectDB } from '../config/database.js';
import { users } from '../drizzle/schema.js';
import { eq, like } from 'drizzle-orm';

// Obtener el directorio actual del módulo
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
let envPath = '/app/env/.env';
if (!existsSync(envPath)) {
  envPath = join(__dirname, '..', '.env');
}

const dbCredentialsPath = '/run/secrets/db_credentials';
if (existsSync(dbCredentialsPath)) {
  dotenv.config({ path: dbCredentialsPath });
}

dotenv.config({ path: envPath });

// Si no se cargaron las variables, intentar leer directamente
if (!process.env.DB_NAME) {
  try {
    if (existsSync(envPath)) {
      const envContent = readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim();
            process.env[key.trim()] = value;
          }
        }
      }
    }
  } catch (err) {
    console.error('Error leyendo .env:', err.message);
  }
}

const newPassword = process.argv[2];
const username = (process.argv[3] || 'admin').toLowerCase();

const resetAdminPassword = async () => {
  try {
    if (!newPassword) {
      console.error('❌ Error: Debes proporcionar una nueva contraseña');
      console.log('');
      console.log('Uso:');
      console.log('  bun scripts/resetAdminPassword.js <nueva-contraseña> [username]');
      console.log('');
      console.log('Ejemplos:');
      console.log('  bun scripts/resetAdminPassword.js miNuevaPassword123');
      console.log('  bun scripts/resetAdminPassword.js miNuevaPassword123 admin');
      console.log('');
      console.log('Desde Docker:');
      console.log('  docker compose exec server bun scripts/resetAdminPassword.js miNuevaPassword123');
      console.log('');
      process.exit(1);
    }

    if (newPassword.length < 6) {
      console.error('❌ Error: La contraseña debe tener al menos 6 caracteres');
      process.exit(1);
    }

    await connectDB();
    console.log('🔗 Conectado a PostgreSQL correctamente');

    // Buscar el usuario (case insensitive approx)
    const userList = await db.select().from(users).where(like(users.username, username));
    if (userList.length === 0) {
      console.error(`❌ Error: No se encontró el usuario "${username}"`);
      process.exit(1);
    }
    const user = userList[0];

    // Hashear la nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Actualizar
    await db.update(users).set({ 
      password: hashedPassword,
      updatedAt: new Date()
    }).where(eq(users.id, user.id));

    console.log('');
    console.log('✅ Contraseña actualizada correctamente');
    console.log(`   Usuario: ${user.username}`);
    console.log(`   Es administrador: ${user.isAdmin ? 'Sí' : 'No'}`);
    console.log(`   Nueva contraseña: ${newPassword}`);
    console.log('');
    console.log('⚠️  IMPORTANTE: Guarda esta contraseña en un lugar seguro');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

resetAdminPassword();

