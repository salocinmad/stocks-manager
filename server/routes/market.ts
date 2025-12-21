import { Elysia, t } from 'elysia';
import { MarketDataService } from '../services/marketData';

export const marketRoutes = new Elysia({ prefix: '/market' })
    // Búsqueda de símbolos en vivo (Yahoo Finance)
    .get('/search', async ({ query }) => {
        const { q } = query;
        if (!q) return [];
        return await MarketDataService.searchSymbols(q);
    }, {
        query: t.Object({
            q: t.String()
        })
    })
    // Obtener tipo de cambio
    .get('/exchange-rate', async ({ query }) => {
        const { from, to } = query;
        if (!from || !to) return { error: 'from and to currencies required' };
        const rate = await MarketDataService.getExchangeRate(from, to);
        return { from, to, rate };
    }, {
        query: t.Object({
            from: t.String(),
            to: t.String()
        })
    })
    // Cotización de un activo
    .get('/quote', async ({ query }) => {
        const { ticker } = query;
        if (!ticker) return { error: 'Ticker required' };
        return await MarketDataService.getQuote(ticker);
    }, {
        query: t.Object({
            ticker: t.String()
        })
    })
    // Noticias de un activo
    .get('/news', async ({ query }) => {
        const { ticker } = query;
        if (!ticker) return { error: 'Ticker required' };
        return await MarketDataService.getNews(ticker);
    }, {
        query: t.Object({
            ticker: t.String()
        })
    })
    // Estado de los mercados
    .get('/status', async () => {
        const DEFAULT_INDICES = ['^IBEX', '^IXIC', '^NYA', '^GDAXI', '^FTSE'];
        return await MarketDataService.getMarketStatus(DEFAULT_INDICES);
    })
    .get('/history', async ({ query }) => {
        const { ticker, range } = query;
        if (!ticker) return { error: 'Ticker required' };
        return await MarketDataService.getHistory(ticker, range || '1mo');
    }, {
        query: t.Object({
            ticker: t.String(),
            range: t.Optional(t.String())
        })
    })
    // Perfil de un activo (sector, industria, etc.)
    .get('/profile', async ({ query }) => {
        const { ticker } = query;
        if (!ticker) return { error: 'Ticker required' };
        return await MarketDataService.getAssetProfile(ticker);
    }, {
        query: t.Object({
            ticker: t.String()
        })
    })
    // Distribución por sectores para múltiples tickers
    .post('/sector-distribution', async (ctx: any) => {
        const tickers = ctx.body?.tickers as string[];
        if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
            return { error: 'tickers array required' };
        }
        return await MarketDataService.getSectorDistribution(tickers);
    }, {
        body: t.Object({
            tickers: t.Array(t.String())
        })
    });
