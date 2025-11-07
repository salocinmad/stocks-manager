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

if (!process.env.MONGODB_URI) {
  try {
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
  } catch (err) {
    console.error('Error leyendo .env:', err.message);
  }
}

const initAdmin = async () => {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Verificar si ya existe un administrador
    const existingAdmin = await User.findOne({ isAdmin: true });
    if (existingAdmin) {
      console.log('ℹ️  Ya existe un usuario administrador:', existingAdmin.username);
      await mongoose.connection.close();
      return;
    }

    // Crear usuario administrador por defecto
    const adminUser = new User({
      username: 'admin',
      password: 'admin123', // Cambiar después del primer login
      isAdmin: true
    });

    await adminUser.save();
    console.log('✅ Usuario administrador creado:');
    console.log('   Usuario: admin');
    console.log('   Contraseña: admin123');
    console.log('   ⚠️  IMPORTANTE: Cambia la contraseña después del primer login');

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

initAdmin();

