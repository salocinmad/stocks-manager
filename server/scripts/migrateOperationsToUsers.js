import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';
import Operation from '../models/Operation.js';
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

const migrateOperations = async () => {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Buscar el usuario admin
    const adminUser = await User.findOne({ isAdmin: true });
    if (!adminUser) {
      console.log('❌ No se encontró ningún usuario administrador');
      await mongoose.connection.close();
      return;
    }

    console.log(`📋 Usuario admin encontrado: ${adminUser.username} (${adminUser._id})`);

    // Buscar operaciones sin userId
    const operationsWithoutUser = await Operation.find({ userId: { $exists: false } });
    console.log(`📊 Operaciones sin usuario encontradas: ${operationsWithoutUser.length}`);

    if (operationsWithoutUser.length === 0) {
      console.log('✅ No hay operaciones que migrar');
      await mongoose.connection.close();
      return;
    }

    // Asignar todas las operaciones al usuario admin
    const result = await Operation.updateMany(
      { userId: { $exists: false } },
      { $set: { userId: adminUser._id } }
    );

    console.log(`✅ Migración completada: ${result.modifiedCount} operaciones asignadas al usuario admin`);

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

migrateOperations();

