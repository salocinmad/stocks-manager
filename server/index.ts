import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { authRoutes } from './routes/auth';
import { portfolioRoutes } from './routes/portfolios';
import { aiRoutes } from './routes/ai';
import { marketRoutes } from './routes/market';
import { watchlistRoutes } from './routes/watchlist';
import { settingsRoutes } from './routes/settings';
import { reportsRoutes } from './routes/reports';
import { importersRoutes } from './routes/importers';
import { adminRoutes } from './routes/admin';
import { alertsRoutes } from './routes/alerts';
import { notificationRoutes } from './routes/notifications';
import { calendarRoutes } from './routes/calendar';
import { publicRoutes } from './routes/public';
import { chatRoutes } from './routes/chat';
import { analysisRoutes } from './routes/analysis';

import { notesRoutes } from './routes/notes';
import { userRoutes } from './routes/user';
import { initDatabase } from './init_db';
import { SettingsService } from './services/settingsService';
import { AlertService } from './services/alertService';
import { MarketDataService } from './services/marketData';
import { schedulePnLJob, calculatePnLForAllPortfolios } from './jobs/pnlJob';

// Initialize DB and load settings
// Initialize DB and load settings

// === LOGGING OVERRIDE (Spanish Timestamp) ===
const getTimestamp = () => new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
const originalInfo = console.info;

console.log = (...args) => originalLog(`[${getTimestamp()}]`, ...args);
console.error = (...args) => originalError(`[${getTimestamp()}]`, ...args);
console.warn = (...args) => originalWarn(`[${getTimestamp()}]`, ...args);
console.info = (...args) => originalInfo(`[${getTimestamp()}]`, ...args);
// ============================================

await initDatabase();
await SettingsService.loadToEnv();

// Start Alert Service Loop (every 60s)
import { PortfolioAlertService } from './services/portfolioAlertService';

setInterval(() => {
    AlertService.checkAlerts().catch(err => console.error('AlertService Error:', err));
    PortfolioAlertService.checkPortfolioAlerts().catch(err => console.error('PortfolioAlertService Error:', err));
}, 60000);

// Initial History Sync: DESACTIVADO para mejorar arranque.
// Los datos se cargarán bajo demanda (Lazy Loading) al consultar tickers o via Admin.
// MarketDataService.syncPortfolioHistory(24)...

// Schedule PnL Pre-calculation Job (runs at 4:00 AM daily)
schedulePnLJob();

// Initial PnL calculation if cache is empty (run once on startup)
setTimeout(() => {
    console.log('[Startup] Running initial PnL pre-calculation...');
    calculatePnLForAllPortfolios().catch(e => console.error('Initial PnL Calc Error:', e));
}, 5000); // Wait 5s for other services to initialize

// Daily Cron Job (04:00 AM Europe/Madrid)
// Updates only last 1 month of data to keep it fresh
let lastRunDay = -1;

setInterval(() => {
    const now = new Date();
    // Obtener hora en Madrid
    const madTimeString = now.toLocaleString("en-US", { timeZone: "Europe/Madrid" });
    const madTime = new Date(madTimeString);

    const day = madTime.getDate();
    const hours = madTime.getHours();
    const minutes = madTime.getMinutes();

    // Ejecutar a las 4:00 AM una vez por día
    if (hours === 4 && minutes === 0 && day !== lastRunDay) {
        lastRunDay = day;
        console.log('⏰ Running Daily Data Sync (04:00 Madrid)...');

        // Sincronizar último mes (1)
        MarketDataService.syncPortfolioHistory(1).catch(e => console.error('Daily Portfolio Sync Error:', e));
        MarketDataService.syncCurrencyHistory(1).catch(e => console.error('Daily Currency Sync Error:', e));
    }
}, 60000); // Check every minute

// Discovery Crawler Job (Configurable Check every 3 mins)
import { DiscoveryJob } from './jobs/discoveryJob';

setInterval(() => {
    DiscoveryJob.runDiscoveryCycle().catch(e => console.error('DiscoveryJob Error:', e));
}, 3 * 60 * 1000); // 3 Minutes (To allow high freq checks)

// Initial Discovery Run (After 30s)
setTimeout(() => {
    console.log('[Startup] Running Initial Discovery Cycle...');
    DiscoveryJob.runDiscoveryCycle().catch(e => console.error('Initial DiscoveryJob Error:', e));
}, 30000);

// Calendar Sync Job (Every 6h)
import { CalendarJob } from './jobs/calendarJob';

setInterval(() => {
    CalendarJob.run().catch(e => console.error('CalendarJob Error:', e));
}, 6 * 60 * 60 * 1000); // 6 Hours

// Initial Calendar Run (After 60s)
setTimeout(() => {
    console.log('[Startup] Running Initial Calendar Sync...');
    CalendarJob.run().catch(e => console.error('Initial CalendarJob Error:', e));
}, 60000);

// Position Analysis Job (Every 6h at 00:00, 06:00, 12:00, 18:00)
import { runPositionAnalysisJob } from './jobs/positionAnalysisJob';

let lastAnalysisHour = -1;
setInterval(() => {
    const now = new Date();
    const madTimeString = now.toLocaleString("en-US", { timeZone: "Europe/Madrid" });
    const madTime = new Date(madTimeString);
    const hour = madTime.getHours();

    // Run at 00, 06, 12, 18
    if ([0, 6, 12, 18].includes(hour) && hour !== lastAnalysisHour) {
        lastAnalysisHour = hour;
        console.log('📊 Running Position Analysis Job...');
        runPositionAnalysisJob().catch(e => console.error('PositionAnalysisJob Error:', e));
    }
}, 60000); // Check every minute

// Initial Analysis Run (After 90s)
setTimeout(() => {
    console.log('[Startup] Running Initial Position Analysis...');
    runPositionAnalysisJob().catch(e => console.error('Initial PositionAnalysisJob Error:', e));
}, 90000);

// Backup Job (Every Minute)
import { BackupJob } from './jobs/backupJob';

setInterval(() => {
    BackupJob.checkAndRun().catch(e => console.error('BackupJob Error:', e));
}, 60000);

// Mapeo de extensiones a tipos MIME
const mimeTypes: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

// Helper para obtener el tipo MIME
const getMimeType = (path: string): string => {
    const ext = path.substring(path.lastIndexOf('.'));
    return mimeTypes[ext] || 'application/octet-stream';
};

const app = new Elysia({
    serve: {
        maxRequestBodySize: 1024 * 1024 * 100 // 100MB
    }
})
    .use(swagger())
    .onError(({ code, error }) => {
        console.error(`Elysia Error [${code}]:`, error);
        return new Response(error instanceof Error ? error.message : 'Unknown Error', { status: 500 });
    })
    // 1. Rutas de API primero
    .group('/api', app => app
        .use(authRoutes)
        .use(portfolioRoutes)
        .use(aiRoutes)
        .use(marketRoutes)
        .use(watchlistRoutes)
        .use(settingsRoutes)
        .use(reportsRoutes)
        .use(importersRoutes)
        .use(adminRoutes)
        .use(alertsRoutes)
        .use(notificationRoutes)
        .use(calendarRoutes)
        .use(chatRoutes)
        .use(notesRoutes)
        .use(userRoutes)
        .use(publicRoutes)
        .use(analysisRoutes)
        .get('/health', () => ({ status: 'ok', version: '1.0.0' }))
    )
    // 2. Servir imágenes de notas desde /uploads
    .get('/api/uploads/notes/:filename', async ({ params }) => {
        const file = Bun.file(`uploads/notes/${params.filename}`);
        if (await file.exists()) {
            const ext = params.filename.split('.').pop() || 'png';
            const mimeMap: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
            return new Response(file, { headers: { 'Content-Type': mimeMap[ext] || 'application/octet-stream' } });
        }
        return new Response('Not found', { status: 404 });
    })
    // 2.1 Servir avatares de usuario desde /uploads/avatars
    // 2.1 Servir avatares de usuario desde /uploads/avatars
    .get('/api/uploads/avatars/:filename', async ({ params }) => {
        const absolutePath = path.join(process.cwd(), 'uploads', 'avatars', params.filename);
        console.log(`[Avatar Request] CWD: ${process.cwd()}`);
        console.log(`[Avatar Request] Looking for: ${absolutePath}`);

        const file = Bun.file(absolutePath);

        if (await file.exists()) {
            console.log(`[Avatar Request] Found: ${absolutePath}, size: ${file.size}`);
            const ext = params.filename.split('.').pop() || 'png';
            const mimeMap: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
            console.log(`[Avatar Request] Check ext: ${ext}, mime: ${mimeMap[ext]}`);
            return new Response(file, { headers: { 'Content-Type': mimeMap[ext] || 'application/octet-stream' } });
        }
        console.error(`[Avatar Request] NOT FOUND: ${absolutePath}`);
        return new Response('Not found', { status: 404 });
    })
    // 3. Servir archivos estáticos explícitamente (JS, CSS, recursos)
    .get('/:filename', async ({ params }) => {
        const filename = params.filename;
        const filePath = `dist/${filename}`;
        const file = Bun.file(filePath);

        if (await file.exists()) {
            return new Response(file, {
                headers: { 'Content-Type': getMimeType(filename) }
            });
        }
        // Si no existe el archivo, servir index.html (SPA fallback)
        return new Response(Bun.file('dist/index.html'), {
            headers: { 'Content-Type': 'text/html' }
        });
    })
    // 3. Ruta raíz y catch-all para SPA
    .get('/', async () => {
        return new Response(Bun.file('dist/index.html'), {
            headers: { 'Content-Type': 'text/html' }
        });
    })
    .get('/*', async ({ path }) => {
        // Para cualquier otra ruta, servir el index.html (SPA routing)
        return new Response(Bun.file('dist/index.html'), {
            headers: { 'Content-Type': 'text/html' }
        });
    })
    .listen(3000);

console.log(`🦊 Stocks Manager Backend running at ${app.server?.hostname}:${app.server?.port}`);
