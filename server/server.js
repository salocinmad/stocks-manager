import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/database.js';
import authRoutes from './routes/auth.js';
import operationRoutes from './routes/operations.js';
import adminRoutes from './routes/admin.js';
import yahooRoutes from './routes/yahoo.js';
import configRoutes from './routes/config.js';
import DailyPrice from './models/DailyPrice.js';
import DailyPortfolioStats from './models/DailyPortfolioStats.js';
import Portfolio from './models/Portfolio.js';
import PortfolioReport from './models/PortfolioReport.js';
import Config from './models/Config.js';
import ProfilePicture from './models/ProfilePicture.js';
import profilePicturesRoutes from './routes/profilePictures.js';
import positionRoutes from './routes/positions.js';
import pricesRoutes from './routes/prices.js';
import notesRoutes from './routes/notes.js';
import portfolioRoutes from './routes/portfolio.js';
import externalButtonsRoutes from './routes/externalButtons.js';
import reportsRoutes from './routes/reports.js';
import scheduler from './services/scheduler.js';
import dailyClose from './services/dailyClose.js';

// Nuevas rutas API modulares
import pricesApiRoutes from './routes/api/prices.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuración de variables de entorno
dotenv.config();

// Configuración de __dirname para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directorio donde se guardarán las imágenes de perfil
const PROFILE_PICTURES_DIR = path.join(__dirname, 'images', 'profile-pictures');

// Asegurarse de que el directorio de imágenes de perfil exista
import fs from 'fs';
if (!fs.existsSync(PROFILE_PICTURES_DIR)) {
  fs.mkdirSync(PROFILE_PICTURES_DIR, { recursive: true });
  console.log(`📂 Directorio de imágenes de perfil creado: ${PROFILE_PICTURES_DIR}`);
}

// Inicializar la aplicación Express
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*', // Permitir solicitudes desde cualquier origen en desarrollo
  credentials: true
}));

app.use(express.json());

// Servir imágenes de perfil estáticas
app.use('/images/profile-pictures', express.static(PROFILE_PICTURES_DIR));

// Global Request Logger
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  next();
});

// Conectar a la base de datos y arrancar scheduler

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/operations', operationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/yahoo', yahooRoutes);
app.use('/api/config', configRoutes);
app.use('/api/positions', positionRoutes);
// app.use('/api/prices', pricesRoutes);  // ← DEPRECATED: usar API modular abajo
app.use('/api/notes', notesRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/profile-pictures', profilePicturesRoutes);
app.use('/api/external-buttons', externalButtonsRoutes);
app.use('/api/reports', reportsRoutes);

// Nuevas rutas API modulares
app.use('/api/prices', pricesApiRoutes);  // ← NUEVO: API modular

// Ruta de estado (Health Check)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Start scheduler after DB sync
connectDB().then(async () => {
  try {
    const r = await scheduler.start();
    if (r.ok) {
      console.log(`🕒 Scheduler iniciado cada ${r.minutes} min`);
    } else {
      console.log(`🕒 Scheduler no iniciado: ${r.reason}`);
    }
    const d = await dailyClose.startDaily();
    if (d.ok) {
      console.log(`📅 Snapshot diario programado a las ${d.timeStr}`)
    } else {
      console.log(`📅 Snapshot diario no iniciado: ${d.reason}`)
    }
  } catch (e) {
    console.log('🕒 Scheduler error al iniciar:', e.message);
  }
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
