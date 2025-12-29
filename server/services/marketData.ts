import YahooFinance from 'yahoo-finance2';
import sql from '../db';

// Crear instancia de yahoo-finance2
const yahooFinance = new YahooFinance();

// ============================================================
// CACHE SYSTEM WITH TTL
// ============================================================
interface CacheEntry<T> {
    data: T;
    expiry: number;
}

const cache = new Map<string, CacheEntry<any>>();

// TTL Configuration (in milliseconds)
const TTL = {
    QUOTE: 60 * 1000,             // 60 seconds - Real-time-ish quotes
    EXCHANGE_RATE: 5 * 60 * 1000, // 5 minutes - Rates change slowly
    PROFILE: 24 * 60 * 60 * 1000, // 24 hours - Sector/Industry rarely changes
    HISTORY: 24 * 60 * 60 * 1000  // 24 hours - Historical data is static
};

function getFromCache<T>(key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}

function setCache<T>(key: string, data: T, ttlMs: number): void {
    cache.set(key, { data, expiry: Date.now() + ttlMs });
}

// Clear expired entries periodically (every 5 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
        if (now > entry.expiry) {
            cache.delete(key);
        }
    }
}, 5 * 60 * 1000);

// ============================================================

interface SymbolSearchResult {
    symbol: string;
    name: string;
    exchange: string;
    type: string;
}

export interface QuoteResult {
    c: number;           // Current price
    pc: number;          // Previous close
    d: number;           // Change
    dp: number;          // Change percent
    currency: string;
    name: string;
    sector?: string;     // Sector de la empresa
    industry?: string;   // Industria específica
    volume?: number;     // Current volume
    averageVolume?: number; // Average volume (10-day or 3-month)
    lastUpdated?: number; // Timestamp of the data
}

export const MarketDataService = {
    // Buscar símbolos usando yahoo-finance2
    async searchSymbols(query: string): Promise<SymbolSearchResult[]> {
        if (!query || query.length < 1) return [];

        try {
            const results = await yahooFinance.search(query, { quotesCount: 10, newsCount: 0 });

            if (!results.quotes) return [];

            // Función de prioridad para ordenar
            const getPriority = (q: any) => {
                const symbol = (q.symbol || '').toUpperCase();
                const exc = (q.exchange || '').toUpperCase();

                // 1. España (.MC, MCE, MAD)
                if (symbol.endsWith('.MC') || exc === 'MCE' || exc === 'MAD' || exc === 'BME') return 3;

                // 2. USA (NMS, NYQ, etc, o sin punto)
                // En Yahoo, los tickers de USA no suelen llevar sufijo (AAPL vs TEF.MC)
                const usaExchanges = ['NMS', 'NYQ', 'NGM', 'ASE', 'PNK', 'NCM', 'NYE', 'NAS'];
                if (usaExchanges.includes(exc) || !symbol.includes('.')) return 2;

                // 3. Resto
                return 1;
            };

            const sortedQuotes = results.quotes.sort((a: any, b: any) => {
                return getPriority(b) - getPriority(a);
            });

            return sortedQuotes
                .filter((q: any) => q.quoteType === 'EQUITY' || q.quoteType === 'ETF')
                .map((q: any) => ({
                    symbol: q.symbol,
                    name: q.shortname || q.longname || q.symbol,
                    exchange: q.exchange,
                    type: q.quoteType
                }));
        } catch (e) {
            console.error('Yahoo Search Error', e);
            return [];
        }
    },

    // Obtener tipo de cambio usando yahoo-finance2 (CACHED)
    async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number | null> {
        if (fromCurrency === toCurrency) return 1.0;

        const cacheKey = `rate:${fromCurrency}:${toCurrency}`;
        const cached = getFromCache<number>(cacheKey);
        if (cached !== null) {
            return cached;
        }

        try {
            const symbol = `${fromCurrency}${toCurrency}=X`;
            const quote = await yahooFinance.quote(symbol);

            if (quote && quote.regularMarketPrice) {
                setCache(cacheKey, quote.regularMarketPrice, TTL.EXCHANGE_RATE);
                return quote.regularMarketPrice;
            }
            return null;
        } catch (e) {
            console.error('Exchange Rate Error', e);
            return null;
        }
    },

    // Obtener cotización usando yahoo-finance2 (CACHED)
    async getQuote(ticker: string): Promise<QuoteResult | null> {
        const cacheKey = `quote:${ticker.toUpperCase()}`;
        const cached = getFromCache<QuoteResult>(cacheKey);
        if (cached !== null) {
            return cached;
        }

        try {
            const quote = await yahooFinance.quote(ticker);

            if (!quote) {
                console.error(`No quote data for ${ticker}`);
                return null;
            }

            const result: QuoteResult = {
                c: quote.regularMarketPrice || 0,
                pc: quote.regularMarketPreviousClose || 0,
                d: quote.regularMarketChange || 0,
                dp: quote.regularMarketChangePercent || 0,
                currency: quote.currency || 'USD',
                name: quote.longName || quote.shortName || ticker,
                volume: quote.regularMarketVolume || 0,
                averageVolume: quote.averageDailyVolume10Day || quote.averageDailyVolume3Month || 0,
                lastUpdated: Date.now()
            };

            setCache(cacheKey, result, TTL.QUOTE);
            return result;
        } catch (e) {
            console.error(`Quote Error for ${ticker}:`, e);
            return null;
        }
    },

    // Obtener perfil del activo (sector/industria) usando quoteSummary (CACHED)
    async getAssetProfile(ticker: string) {
        const cacheKey = `profile:${ticker.toUpperCase()}`;
        const cached = getFromCache<any>(cacheKey);
        if (cached !== null) {
            return cached;
        }

        try {
            const result = await yahooFinance.quoteSummary(ticker, {
                modules: ['summaryProfile', 'price']
            });

            const profile = {
                sector: result.summaryProfile?.sector || 'Desconocido',
                industry: result.summaryProfile?.industry || 'Desconocido',
                country: result.summaryProfile?.country || 'Desconocido',
                website: result.summaryProfile?.website || null,
                longBusinessSummary: result.summaryProfile?.longBusinessSummary || null,
                fullTimeEmployees: result.summaryProfile?.fullTimeEmployees || null
            };

            setCache(cacheKey, profile, TTL.PROFILE);
            return profile;
        } catch (e) {
            console.error(`Asset Profile Error for ${ticker}:`, e);
            return {
                sector: 'Desconocido',
                industry: 'Desconocido',
                country: 'Desconocido'
            };
        }
    },

    // Obtener cotización completa con sector/industria
    async getQuoteWithProfile(ticker: string): Promise<QuoteResult | null> {
        try {
            // Obtener quote y profile en paralelo
            const [quote, profile] = await Promise.all([
                this.getQuote(ticker),
                this.getAssetProfile(ticker)
            ]);

            if (!quote) return null;

            return {
                ...quote,
                sector: profile.sector,
                industry: profile.industry
            };
        } catch (e) {
            console.error(`QuoteWithProfile Error for ${ticker}:`, e);
            return null;
        }
    },

    // Obtener noticias en español usando Yahoo Finance
    async getNews(ticker: string) {
        try {
            // Usar yahoo-finance2 search con configuración regional española
            const results = await yahooFinance.search(ticker, {
                quotesCount: 1,
                newsCount: 15,
                // @ts-ignore - Las opciones de región existen pero pueden no estar tipadas
                region: 'ES',
                lang: 'es-ES'
            });

            // Mapear las noticias al formato esperado
            const newsItems = (results.news || []).map((article: any, index: number) => {
                // Yahoo Finance incluye thumbnail en las noticias
                // Solo usamos imagen si viene de Yahoo Finance, sino dejamos vacío
                // para que el frontend muestre el ticker como fallback visual
                let image = '';
                if (article.thumbnail?.resolutions?.length > 0) {
                    const resolutions = article.thumbnail.resolutions;
                    // Preferir resolución media o alta
                    image = resolutions[Math.min(1, resolutions.length - 1)]?.url || '';
                }

                return {
                    id: Date.now() + index,
                    headline: article.title || '',
                    url: article.link || '',
                    datetime: article.providerPublishTime || Math.floor(Date.now() / 1000),
                    source: article.publisher || 'Yahoo Finance',
                    summary: article.title || '',
                    image, // Vacío si no hay thumbnail real
                    category: 'finance',
                    related: ticker
                };
            });

            // Ordenar por fecha (más recientes primero)
            newsItems.sort((a: any, b: any) => b.datetime - a.datetime);

            return newsItems;
        } catch (e) {
            console.error('Yahoo Finance News Error', e);

            // Fallback a Google News en español si Yahoo falla
            try {
                const searchQuery = encodeURIComponent(`${ticker} bolsa acciones`);
                const rssUrl = `https://news.google.com/rss/search?q=${searchQuery}&hl=es&gl=ES&ceid=ES:es`;

                const response = await fetch(rssUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });

                const xmlText = await response.text();
                const items: any[] = [];
                const itemMatches = xmlText.match(/<item>([\s\S]*?)<\/item>/g) || [];

                for (let i = 0; i < Math.min(itemMatches.length, 10); i++) {
                    const itemXml = itemMatches[i];

                    const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/);
                    const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
                    const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
                    const sourceMatch = itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/);

                    const cleanText = (text: string | undefined) => {
                        if (!text) return '';
                        return text
                            .replace(/<!\[CDATA\[/g, '')
                            .replace(/\]\]>/g, '')
                            .replace(/<[^>]*>/g, '')
                            .trim();
                    };

                    const headline = cleanText(titleMatch?.[1]);
                    const url = linkMatch?.[1]?.trim() || '';
                    const pubDate = pubDateMatch?.[1]?.trim() || '';
                    const source = cleanText(sourceMatch?.[1]) || 'Google News';

                    if (headline && url) {
                        items.push({
                            id: Date.now() + i,
                            headline,
                            url,
                            datetime: Math.floor(new Date(pubDate).getTime() / 1000),
                            source,
                            summary: headline,
                            image: '', // Dejar vacío para que frontend muestre ticker
                            category: 'finance',
                            related: ticker
                        });
                    }
                }

                // Ordenar cronológicamente
                items.sort((a, b) => b.datetime - a.datetime);
                return items;
            } catch (e2) {
                console.error('Google News Fallback Error', e2);
                return [];
            }
        }
    },

    // Estado de mercados usando yahoo-finance2
    async getMarketStatus(indices: string[]) {
        const results = await Promise.all(indices.map(async (symbol) => {
            try {
                const quote = await yahooFinance.quote(symbol);

                if (quote) {
                    return {
                        symbol,
                        name: quote.shortName || quote.symbol,
                        state: quote.marketState || 'UNKNOWN',
                        exchangeName: quote.fullExchangeName || quote.exchange
                    };
                }
                return { symbol, state: 'UNKNOWN' };
            } catch (e) {
                return { symbol, state: 'ERROR' };
            }
        }));
        return results;
    },

    // Historial de precios usando yahoo-finance2
    async getHistory(ticker: string, range: string = '1mo') {
        try {
            // Mapear rangos a períodos para yahoo-finance2
            const periodMap: Record<string, { period1: Date; period2: Date; interval: '1d' | '1wk' | '1mo' }> = {
                '1d': { period1: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), period2: new Date(), interval: '1d' },
                '5d': { period1: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), period2: new Date(), interval: '1d' },
                '1mo': { period1: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), period2: new Date(), interval: '1d' },
                '3mo': { period1: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), period2: new Date(), interval: '1d' },
                '6mo': { period1: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), period2: new Date(), interval: '1wk' },
                '1y': { period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), period2: new Date(), interval: '1wk' },
                '5y': { period1: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000), period2: new Date(), interval: '1mo' }
            };

            const config = periodMap[range] || periodMap['1mo'];

            const result = await yahooFinance.chart(ticker, {
                period1: config.period1,
                period2: config.period2,
                interval: config.interval
            });

            if (!result.quotes) return [];

            return result.quotes.map((q: any) => ({
                date: new Date(q.date).toISOString().split('T')[0],
                price: q.close
            })).filter((item: any) => item.price !== null);
        } catch (e) {
            console.error('History Fetch Error', e);
            return [];
        }
    },

    // Buscar Ticker por ISIN
    async getTickerByISIN(isin: string): Promise<string | null> {
        if (!isin) return null;
        try {
            const results = await yahooFinance.search(isin);
            if (results.quotes && results.quotes.length > 0) {
                // Preferir EQUITY
                const equity = results.quotes.find((q: any) => q.quoteType === 'EQUITY' || q.quoteType === 'ETF');
                return equity ? equity.symbol : results.quotes[0].symbol;
            }
            return null;
        } catch (e) {
            console.error(`Error buscando ISIN ${isin}:`, e);
            return null;
        }
    },

    // Obtener detalle completo por ISIN (incluyendo divisa del mercado)
    async getTickerDetailsByISIN(isin: string): Promise<{ symbol: string; currency: string; name: string } | null> {
        if (!isin) return null;
        try {
            const results = await yahooFinance.search(isin);
            if (results.quotes && results.quotes.length > 0) {
                const equity = results.quotes.find((q: any) => q.quoteType === 'EQUITY' || q.quoteType === 'ETF') || results.quotes[0];

                let currency = (equity as any).currency;

                // Si search no devuelve currency, probar con quote ligero
                if (!currency) {
                    try {
                        const q = await yahooFinance.quote(equity.symbol);
                        currency = q?.currency;
                    } catch (err) { }
                }

                return {
                    symbol: equity.symbol,
                    currency: currency || 'USD', // Fallback
                    name: (equity as any).longname || (equity as any).shortname || equity.symbol
                };
            }
            return null;
        } catch (e) {
            console.error(`Error buscando detalle ISIN ${isin}:`, e);
            return null;
        }
    },

    // Obtener tasa de cambio histórica para una fecha específica
    async getHistoricalExchangeRate(fromCurrency: string, toCurrency: string, date: Date): Promise<number> {
        if (fromCurrency === toCurrency) return 1.0;

        // Yahoo symbols: EURUSD=X (1 EUR = x USD). 
        // Si quiero pasar de USD a EUR: necesito USD/EUR. O 1 / (EUR/USD).
        // Normalmente usamos pares "Major".

        let symbol = `${fromCurrency}${toCurrency}=X`;
        let invert = false;

        // Yahoo tiene pares standard. Intentamos directo.
        // Pero para USD -> EUR, Yahoo suele usar EURUSD=X (Value in USD of 1 EUR).
        // Entonces si tengo USD y quiero EUR: Cantidad USD / (EURUSD Rate) => EUR.
        // Si el usuario da "USD" y "EUR". Pido "EURUSD=X". El precio es "dolares por euro".
        // Entonces retorno el rate DIRECTO de conversión `from -> to`.

        if (toCurrency === 'EUR' && fromCurrency === 'USD') {
            symbol = 'EURUSD=X';
            invert = true; // El rate es USD/EUR. Yo quiero EUR/USD. (1/rate)
        } else if (toCurrency === 'USD' && fromCurrency === 'EUR') {
            symbol = 'EURUSD=X'; // Rate es USD/EUR. Directo es 1 EUR = x USD.
            invert = false;
        }

        try {
            // Pedimos rango de 3 días alrededor de la fecha por si es finde
            const startDate = new Date(date);
            startDate.setDate(startDate.getDate() - 2);
            const endDate = new Date(date);
            endDate.setDate(endDate.getDate() + 2); // quoteSummary necesita margen

            const result = await yahooFinance.chart(symbol, {
                period1: startDate,
                period2: endDate,
                interval: '1d'
            });

            if (!result.quotes || result.quotes.length === 0) return 1.0;

            // Buscar la fecha más cercana sin pasarse (o la misma)
            const targetTime = date.getTime();
            // quotes tiene "date"
            // Encontramos el quote del dia exacto o el immediately previous
            let bestRate = result.quotes[0].close;
            let minDiff = Number.MAX_VALUE;

            for (const q of result.quotes) {
                const qDate = new Date(q.date).getTime();
                const diff = Math.abs(targetTime - qDate);
                if (diff < minDiff) {
                    minDiff = diff;
                    bestRate = q.close;
                }
            }

            if (invert && bestRate) return 1 / bestRate;
            return bestRate || 1.0;

        } catch (e) {
            console.error(`Error fetching historical rate for ${fromCurrency}/${toCurrency} on ${date}:`, e);
            return 1.0; // Fallback
        }
    },

    // Obtener sectores de múltiples tickers (para distribución por sector)
    async getSectorDistribution(tickers: string[]): Promise<Record<string, { sector: string; industry: string }>> {
        const results: Record<string, { sector: string; industry: string }> = {};

        await Promise.all(tickers.map(async (ticker) => {
            const profile = await this.getAssetProfile(ticker);
            results[ticker] = {
                sector: profile.sector,
                industry: profile.industry
            };
        }));

        return results;
    },

    // Obtener historial detallado (caché en DB) para IA
    // ESTRATEGIA: "Fresh or Fallback"
    // 1. Intentar DB Fresca
    // 2. Si falla/viejo -> Yahoo
    // 3. Si falla Yahoo -> DB (Last Resort)
    async getKnownTickers(): Promise<string[]> {
        try {
            // Fetch distinct tickers from all relevant tables
            // We use UNION to combine and remove duplicates automatically
            const result = await sql`
                SELECT DISTINCT ticker FROM historical_data WHERE ticker IS NOT NULL
                UNION
                SELECT DISTINCT ticker FROM positions WHERE ticker IS NOT NULL
                UNION
                SELECT DISTINCT symbol as ticker FROM watchlists WHERE symbol IS NOT NULL
                UNION
                SELECT DISTINCT ticker FROM alerts WHERE ticker IS NOT NULL
            `;
            const tickers = result.map(r => r.ticker as string);

            return tickers;
        } catch (error) {
            console.error('Error fetching known tickers:', error);
            return [];
        }
    },

    async getDetailedHistory(ticker: string, years: number = 1): Promise<any[]> {
        const symbol = ticker.trim().toUpperCase();


        try {
            // 1. Check DB Freshness
            const lastUpdateResult = await sql`
                SELECT MAX(date) as last_date FROM historical_data WHERE ticker = ${symbol}
            `;
            const lastDate = lastUpdateResult[0]?.last_date ? new Date(lastUpdateResult[0].last_date) : null;


            const thresholdDate = new Date();
            thresholdDate.setDate(thresholdDate.getDate() - 2);

            if (lastDate && lastDate >= thresholdDate) {
                const msInYear = 365.25 * 24 * 60 * 60 * 1000;
                const cutoffDate = new Date(Date.now() - (years * msInYear));

                const dataFromDb = await sql`
                    SELECT date, open, high, low, close, volume 
                    FROM historical_data 
                    WHERE ticker = ${symbol} 
                    AND date >= ${cutoffDate}
                    ORDER BY date ASC
                `;

                if (dataFromDb.length > 0) {

                    return dataFromDb;
                }
                console.warn(`[MarketData] DB appeared fresh but returned 0 rows. Falling through to Yahoo.`);
            } else {

            }

            // 2. Fetch Yahoo
            const period1 = new Date();
            const msInYear = 365.25 * 24 * 60 * 60 * 1000;
            period1.setTime(Date.now() - (years * msInYear));

            const chartResult = await yahooFinance.chart(symbol, {
                period1: period1,
                period2: new Date(),
                interval: '1d'
            });
            const results = chartResult?.quotes || [];


            if (!results || results.length === 0) {
                throw new Error("Yahoo returned empty results");
            }

            // 3. Upsert DB
            const rowsToInsert = results.map((r: any) => ({
                ticker: symbol,
                date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : new Date(r.date).toISOString().split('T')[0],
                open: Number(r.open) || 0,
                high: Number(r.high) || 0,
                low: Number(r.low) || 0,
                close: Number(r.close) || 0,
                volume: Math.round(Number(r.volume) || 0)
            }));

            const batchSize = 100;
            for (let i = 0; i < rowsToInsert.length; i += batchSize) {
                const batch = rowsToInsert.slice(i, i + batchSize);
                await Promise.all(batch.map(row =>
                    sql`
                        INSERT INTO historical_data (ticker, date, open, high, low, close, volume)
                        VALUES (${row.ticker}, ${row.date}::date, ${row.open}, ${row.high}, ${row.low}, ${row.close}, ${row.volume})
                        ON CONFLICT (ticker, date) DO UPDATE SET
                            open = EXCLUDED.open,
                            high = EXCLUDED.high,
                            low = EXCLUDED.low,
                            close = EXCLUDED.close,
                            volume = EXCLUDED.volume,
                            updated_at = NOW()
                    `
                ));
            }

            return rowsToInsert;

        } catch (e) {
            console.error(`[MarketData] Primary fetch failed for ${symbol}:`, e);

            // 4. LAST RESORT FALLBACK
            try {
                const fallbackData = await sql`
                    SELECT date, open, high, low, close, volume 
                    FROM historical_data 
                    WHERE ticker = ${symbol} 
                    ORDER BY date ASC
                `;

                if (fallbackData.length > 0) {

                    return fallbackData;
                }

                console.warn(`[MarketData] SAFETY NET FAILED: No local data found for ${symbol}`);
                return [];

            } catch (dbErr) {
                console.error(`[MarketData] CRITICAL: Fallback DB query failed for ${symbol}`, dbErr);
                return [];
            }
        }
    },

    // Sincronizar historial de TODAS las acciones conocidas (cartera + historial)
    // Parametro 'months' para definir cuanto tiempo atrás buscar (default 24 meses = 2 años)
    async syncPortfolioHistory(months: number = 24) {
        try {
            console.log(`Starting portfolio history sync (last ${months} months)...`);
            const tickers = await sql`
                SELECT DISTINCT ticker FROM (
                    SELECT ticker FROM positions
                    UNION
                    SELECT ticker FROM transactions
                ) as all_tickers
                WHERE ticker IS NOT NULL AND ticker != ''
            `;

            console.log(`Syncing history for ${tickers.length} tickers...`);

            const years = months / 12;

            for (const t of tickers) {
                // Si es actualización diaria (ej: 1 mes), pasamos ese rango
                // Si es inicio (24 meses), pasamos eso.
                // getDetailedHistory descarga "years" si no hay datos recientes.
                // Pero si forzamos actualización diaria, la lógica de getDetailedHistory
                // actualmente solo descarga si es necesario.
                // Para el cron diario, quizás queremos forzar la comprobación de los últimos 30 días.

                await this.getDetailedHistory(t.ticker, years);
                await new Promise(resolve => setTimeout(resolve, 300)); // Rate limit pause
            }
            console.log('Portfolio history sync completed.');
        } catch (e) {
            console.error('Error syncing portfolio history:', e);
        }
    },

    // Sincronizar historial de divisas (Divisa -> EUR)
    async syncCurrencyHistory(months: number = 24) {
        try {
            console.log(`Starting currency history sync (last ${months} months)...`);
            // Obtener divisas únicas distintas de EUR
            const currencies = await sql`
                SELECT DISTINCT currency FROM (
                    SELECT currency FROM positions WHERE currency != 'EUR'
                    UNION
                    SELECT currency FROM transactions WHERE currency != 'EUR'
                ) as all_currencies
                WHERE currency IS NOT NULL AND currency != ''
            `;

            console.log(`Syncing history for ${currencies.length} currencies: ${currencies.map(c => c.currency).join(', ')}`);

            const period1 = new Date();
            period1.setMonth(period1.getMonth() - months);

            for (const c of currencies) {
                const currency = c.currency;
                const tickerYahoo = `${currency}EUR=X`; // Ejemplo: USDEUR=X
                const dbTicker = `${currency}/EUR`; // Formato solicitado para guardar en BD

                try {
                    const chartResult = await yahooFinance.chart(tickerYahoo, {
                        period1: period1,
                        period2: new Date(),
                        interval: '1d'
                    });
                    const results = chartResult?.quotes || [];

                    if (results && results.length > 0) {
                        const rowsToInsert = results.map((r: any) => ({
                            ticker: dbTicker,
                            date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : new Date(r.date).toISOString().split('T')[0],
                            open: Number(r.open) || 0,
                            high: Number(r.high) || 0,
                            low: Number(r.low) || 0,
                            close: Number(r.close) || 0,
                            volume: Math.round(Number(r.volume) || 0)
                        }));

                        // Insertar en bloques pequeños
                        const batchSize = 100;
                        for (let i = 0; i < rowsToInsert.length; i += batchSize) {
                            const batch = rowsToInsert.slice(i, i + batchSize);
                            await Promise.all(batch.map(row =>
                                sql`
                                    INSERT INTO historical_data (ticker, date, open, high, low, close, volume)
                                    VALUES (${row.ticker}, ${row.date}::date, ${row.open}, ${row.high}, ${row.low}, ${row.close}, ${row.volume})
                                    ON CONFLICT (ticker, date) DO UPDATE SET
                                        open = EXCLUDED.open,
                                        high = EXCLUDED.high,
                                        low = EXCLUDED.low,
                                        close = EXCLUDED.close,
                                        volume = EXCLUDED.volume,
                                        updated_at = NOW()
                                `
                            ));
                        }
                        console.log(`Synced ${dbTicker} (${rowsToInsert.length} days)`);
                    }
                } catch (err) {
                    console.error(`Error syncing currency ${dbTicker}:`, err);
                }
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            console.log('Currency history sync completed.');
        } catch (e) {
            console.error('Error syncing currency history:', e);
        }
    }
};

