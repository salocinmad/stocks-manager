import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
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
import { initDatabase } from './init_db';
import { SettingsService } from './services/settingsService';
import { AlertService } from './services/alertService';
import { MarketDataService } from './services/marketData';

// Initialize DB and load settings
await initDatabase();
await SettingsService.loadToEnv();

// Start Alert Service Loop (every 60s)
setInterval(() => {
    AlertService.checkAlerts().catch(err => console.error('AlertService Error:', err));
}, 60000);

// Initial History Sync: DESACTIVADO para mejorar arranque.
// Los datos se cargarán bajo demanda (Lazy Loading) al consultar tickers o via Admin.
// MarketDataService.syncPortfolioHistory(24)...

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

const app = new Elysia()
    .use(cors())
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
        .get('/health', () => ({ status: 'ok', version: '1.0.0' }))
    )
    // 2. Servir archivos estáticos explícitamente (JS, CSS, recursos)
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
