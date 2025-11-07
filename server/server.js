import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';
import { connectDB } from './config/database.js';
import operationsRoutes from './routes/operations.js';
import configRoutes from './routes/config.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import yahooRoutes from './routes/yahoo.js';
import { authenticate } from './middleware/auth.js';

// Obtener el directorio actual del módulo
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
// Primero intentamos /app/env/.env (donde está el volumen), luego /app/.env (enlace simbólico o ruta por defecto)
let envPath = '/app/env/.env';
if (!existsSync(envPath)) {
  envPath = join(__dirname, '.env');
}
console.log('📁 Buscando .env en:', envPath);

// Intentar cargar el .env
dotenv.config({ path: envPath });

// Siempre intentar leer el .env directamente para asegurar que todas las variables se carguen
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
    console.log('✅ Variables cargadas desde .env');
  }
} catch (err) {
  console.log('❌ Error leyendo .env:', err.message);
}

// Debug: mostrar qué connection string está usando
console.log('🔍 MongoDB URI:', process.env.MONGODB_URI ? '✅ Configurada' : '❌ No encontrada');
if (process.env.MONGODB_URI) {
  // Mostrar solo los primeros y últimos caracteres por seguridad
  const uri = process.env.MONGODB_URI;
  const masked = uri.substring(0, 20) + '...' + uri.substring(uri.length - 20);
  console.log('   URI:', masked);
}

const app = express();
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Verificar JWT_SECRET
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET no configurado. Usando valor por defecto (NO SEGURO PARA PRODUCCIÓN)');
}

// Debug: verificar que MASTER_PASSWORD se cargó (solo mostrar si existe, no el valor)
if (process.env.MASTER_PASSWORD) {
  console.log('🔐 MASTER_PASSWORD: ✅ Configurada (' + process.env.MASTER_PASSWORD.length + ' caracteres)');
  // Mostrar solo los primeros y últimos caracteres por seguridad
  const masked = process.env.MASTER_PASSWORD.substring(0, 10) + '...' + process.env.MASTER_PASSWORD.substring(process.env.MASTER_PASSWORD.length - 10);
  console.log('   Contraseña (mascarada):', masked);
} else {
  console.warn('⚠️  MASTER_PASSWORD no configurada. Usando valor por defecto');
}

// Middleware
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true
}));
app.use(express.json());

// Middleware de logging para debug (todas las peticiones)
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path}`);
  if (req.path.includes('recover-admin-password')) {
    console.log('   🔍 Esta es una petición de recuperación de contraseña');
  }
  next();
});

// Conectar a MongoDB (no bloquea el servidor si falla)
connectDB().catch(err => {
  console.error('⚠️  No se pudo conectar a MongoDB. El servidor continuará pero no guardará datos.');
});

// Rutas públicas
app.use('/api/auth', authRoutes);

// Rutas protegidas (requieren autenticación)
// Nota: operationsRoutes y yahooRoutes ya tienen authenticate en su router
app.use('/api/operations', operationsRoutes);
app.use('/api/config', authenticate, configRoutes);
app.use('/api/yahoo', yahooRoutes);

// Rutas de administración (requieren autenticación + admin)
app.use('/api/admin', adminRoutes);

// Ruta de salud
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Portfolio Manager API está funcionando' });
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Algo salió mal!' });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📡 CORS configurado para: ${CORS_ORIGIN}`);
});

