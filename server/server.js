import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuración de variables de entorno
dotenv.config();

// Configuración de __dirname para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicializar la aplicación Express
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*', // Permitir solicitudes desde cualquier origen en desarrollo
  credentials: true
}));
app.use(express.json());

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
app.use('/api/prices', pricesRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/portfolio', portfolioRoutes);

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
