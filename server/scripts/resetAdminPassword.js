import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';
import User from '../models/User.js';

// Obtener el directorio actual del módulo
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
// Primero intentamos /app/env/.env (donde está el volumen), luego /app/.env (enlace simbólico o ruta por defecto)
let envPath = '/app/env/.env';
if (!existsSync(envPath)) {
  envPath = join(__dirname, '..', '.env');
}
dotenv.config({ path: envPath });

// Si no se cargó, intentar leer directamente
if (!process.env.MONGODB_URI) {
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
  try {
    if (!newPassword) {
      console.error('❌ Error: Debes proporcionar una nueva contraseña');
      console.log('');
      console.log('Uso:');
      console.log('  npm run reset-admin-password <nueva-contraseña> [username]');
      console.log('');
      console.log('Ejemplos:');
      console.log('  npm run reset-admin-password miNuevaPassword123');
      console.log('  npm run reset-admin-password miNuevaPassword123 admin');
      console.log('');
      process.exit(1);
    }

    if (newPassword.length < 6) {
      console.error('❌ Error: La contraseña debe tener al menos 6 caracteres');
      process.exit(1);
    }

    // Conectar a MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/portfolio-manager';
    console.log('🔗 Conectando a MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado a MongoDB');

    // Buscar el usuario
    const user = await User.findOne({ username: username.toLowerCase() });
    
    if (!user) {
      console.error(`❌ Error: No se encontró el usuario "${username}"`);
      await mongoose.connection.close();
      process.exit(1);
    }

    // Actualizar la contraseña (se hasheará automáticamente por el pre-save hook)
    user.password = newPassword;
    await user.save();

    console.log('');
    console.log('✅ Contraseña actualizada correctamente');
    console.log(`   Usuario: ${user.username}`);
    console.log(`   Es administrador: ${user.isAdmin ? 'Sí' : 'No'}`);
    console.log(`   Nueva contraseña: ${newPassword}`);
    console.log('');
    console.log('⚠️  IMPORTANTE: Guarda esta contraseña en un lugar seguro');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

resetAdminPassword();

