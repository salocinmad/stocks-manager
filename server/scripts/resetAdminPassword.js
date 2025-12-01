import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';
import { Sequelize } from 'sequelize';
import bcrypt from 'bcryptjs';

// Obtener el directorio actual del módulo
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
// Primero intentamos /app/env/.env (donde está el volumen), luego /app/.env (enlace simbólico o ruta por defecto)
let envPath = '/app/env/.env';
if (!existsSync(envPath)) {
  envPath = join(__dirname, '..', '.env');
}

// Cargar credenciales de la base de datos desde /run/secrets/db_credentials si existen
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

// Obtener la nueva contraseña de los argumentos de línea de comandos
const newPassword = process.argv[2];
const username = process.argv[3] || 'admin';

const resetAdminPassword = async () => {
  let sequelize;

  try {
    if (!newPassword) {
      console.error('❌ Error: Debes proporcionar una nueva contraseña');
      console.log('');
      console.log('Uso:');
      console.log('  node scripts/resetAdminPassword.js <nueva-contraseña> [username]');
      console.log('');
      console.log('Ejemplos:');
      console.log('  node scripts/resetAdminPassword.js miNuevaPassword123');
      console.log('  node scripts/resetAdminPassword.js miNuevaPassword123 admin');
      console.log('');
      console.log('Desde Docker:');
      console.log('  docker compose exec server node scripts/resetAdminPassword.js miNuevaPassword123');
      console.log('');
      process.exit(1);
    }

    if (newPassword.length < 6) {
      console.error('❌ Error: La contraseña debe tener al menos 6 caracteres');
      process.exit(1);
    }

    // Conectar a MariaDB
    console.log('🔗 Conectando a MariaDB...');
    sequelize = new Sequelize(
      process.env.DB_NAME || 'portfolio_manager',
      process.env.DB_USER || 'user',
      process.env.DB_PASS || 'password',
      {
        host: process.env.DB_HOST || 'mariadb',
        dialect: 'mysql',
        logging: false
      }
    );

    await sequelize.authenticate();
    console.log('✅ Conectado a MariaDB correctamente');

    // Buscar el usuario
    const [users] = await sequelize.query(
      'SELECT * FROM Users WHERE username = :username LIMIT 1',
      {
        replacements: { username: username.toLowerCase() },
        type: Sequelize.QueryTypes.SELECT
      }
    );

    if (!users) {
      console.error(`❌ Error: No se encontró el usuario "${username}"`);
      await sequelize.close();
      process.exit(1);
    }

    // Hashear la nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Actualizar la contraseña en la base de datos
    await sequelize.query(
      'UPDATE Users SET password = :password, updatedAt = NOW() WHERE id = :id',
      {
        replacements: {
          password: hashedPassword,
          id: users.id
        }
      }
    );

    console.log('');
    console.log('✅ Contraseña actualizada correctamente');
    console.log(`   Usuario: ${users.username}`);
    console.log(`   Es administrador: ${users.isAdmin ? 'Sí' : 'No'}`);
    console.log(`   Nueva contraseña: ${newPassword}`);
    console.log('');
    console.log('⚠️  IMPORTANTE: Guarda esta contraseña en un lugar seguro');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (sequelize) {
      await sequelize.close();
    }
    process.exit(1);
  }
};

resetAdminPassword();

