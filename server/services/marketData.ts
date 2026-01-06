import sql from '../db';
import { NewsService } from './newsService';
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
import { DiscoveryService, DiscoveryItem } from './discoveryService';

// ============================================================
// CACHE SYSTEM WITH TTL (DB PERSISTED)
// ============================================================

// TTL Configuration (in milliseconds)
const TTL = {
    QUOTE: 60 * 1000,             // 60 seconds - Real-time-ish quotes
    EXCHANGE_RATE: 5 * 60 * 1000, // 5 minutes - Rates change slowly
    ANALYST: 12 * 60 * 60 * 1000, // 12 hours - Analyst recommendations (v2.1.0)
    FUNDAMENTALS: 14 * 24 * 60 * 60 * 1000, // 14 days - Fundamental data (v2.2.0)
    PROFILE: 24 * 60 * 60 * 1000, // 24 hours - Sector/Industry rarely changes
    HISTORY: 24 * 60 * 60 * 1000  // 24 hours - Historical data is static
};

// ============================================================
// MARKET STATUS CACHE (In-Memory - Single source of truth)
// ============================================================
// This cache ensures only 1 Yahoo API call per minute for market status,
// regardless of how many browser tabs/clients are connected.
interface MarketStatusCacheEntry {
    data: any[];
    updatedAt: number;
    indices: string[];
}

let marketStatusCache: MarketStatusCacheEntry | null = null;
const MARKET_STATUS_TTL = 60 * 1000; // 1 minute

async function getFromCache<T>(key: string): Promise<T | null> {
    try {
        const result = await sql`
            SELECT data FROM market_cache 
            WHERE key = ${key} AND expires_at > NOW()
        `;
        if (result.length > 0) {
            return result[0].data as T;
        }
        return null;
    } catch (e) {
        console.error('Cache Read Error:', e);
        return null;
    }
}

async function setCache<T>(key: string, data: T, ttlMs: number): Promise<void> {
    try {
        const expiresAt = new Date(Date.now() + ttlMs);
        await sql`
            INSERT INTO market_cache (key, data, expires_at)
            VALUES (${key}, ${data as any}, ${expiresAt})
            ON CONFLICT (key) DO UPDATE 
            SET data = EXCLUDED.data, expires_at = EXCLUDED.expires_at, created_at = NOW()
        `;
    } catch (e) {
        console.error('Cache Write Error:', e);
    }
}

// Clear expired entries periodically (every 10 minutes)
setInterval(async () => {
    try {
        await sql`DELETE FROM market_cache WHERE expires_at < NOW()`;
    } catch (e) {
        console.error('Cache Cleanup Error:', e);
    }
}, 10 * 60 * 1000);

// ============================================================
export interface SymbolSearchResult {
    symbol: string;
    name: string;
    exchange: string;
    type: string;
    currency?: string;
}

export interface QuoteResult {
    c: number;           // Current price
    breakdown?: {
        buy: number;
        sell: number;
        hold: number;
        strongBuy: number;
        strongSell: number;
    };
    insiderSentiment?: {
        mspr: number;
        label: string;
    };
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
    state?: string;      // Market state (REGULAR, CLOSED, etc)
    exchange?: string;   // Exchange name

    // Fundamental Data (New)
    marketCap?: string;  // Market Capitalization (Fmt)
    peRatio?: string;    // Price-to-Earnings (Fmt)
    beta?: string;       // Beta (Volatility)
    earningsDate?: string; // Next Earnings Date
    targetMeanPrice?: string; // Analyst Target Price
    recommendationKey?: string; // Analyst Recommendation (buy, hold, sell)
    shortRatio?: string; // Short Interest Ratio
    yearLow?: number;    // 52 Week Low
    yearHigh?: number;   // 52 Week High
}

export interface FundamentalData {
    marketCap: number;          // Capitalización
    enterpriseValue: number;    // Valor Empresa (EV)
    trailingPE: number;         // PER Real
    forwardPE: number;          // PER Estimado
    pegRatio: number;           // PEG
    priceToSales: number;       // Precio/Ventas
    priceToBook: number;        // Precio/Libro

    // Rentabilidad
    profitMargins: number;      // Margen Neto
    operatingMargins: number;   // Margen Operativo
    grossMargins: number;       // Margen Bruto [NEW]
    ebitdaMargins: number;      // Margen EBITDA [NEW]
    returnOnEquity: number;     // ROE
    returnOnAssets: number;     // ROA

    // Crecimiento [NEW]
    revenueGrowth: number;      // Crecimiento Ventas
    earningsGrowth: number;     // Crecimiento Beneficios

    // Estado Financiero & Cash Flow
    totalRevenue: number;       // Ingresos Totales
    ebitda: number;             // EBITDA
    totalCash: number;          // Caja Total
    totalDebt: number;          // Deuda Total
    debtToEquity: number;       // Deuda/Capital
    currentRatio: number;       // Liquidez Corriente
    quickRatio: number;         // Liquidez Ácida (Quick) [NEW]
    freeCashflow: number;       // Free Cash Flow [NEW]
    operatingCashflow: number;  // Operating Cash Flow [NEW]

    // Por Acción
    trailingEps: number;        // BPA (EPS) Real
    forwardEps: number;         // BPA Estimado
    bookValue: number;          // Valor en Libros
    revenuePerShare: number;    // Ventas por Acción [NEW]
    totalCashPerShare: number;  // Caja por Acción [NEW]

    // Dividendos
    dividendRate: number;       // Dividendo Anual ($)
    dividendYield: number;      // Rentabilidad (%)
    payoutRatio: number;        // Payout (%)
    exDividendDate: string;     // Fecha Ex-Dividend

    // Estructura y Sentimiento [NEW]
    heldPercentInstitutions: number; // % Institucional
    heldPercentInsiders: number;     // % Insiders
    shortRatio: number;              // Short Ratio (Days to Cover)

    extended?: any; // New field for deep persistence

    // Normalized Fields (v2.3.0) - Root level access for critical data
    targetPrice?: number;
    recommendationKey?: string;
    fairValue?: number; // Graham Number
}

export interface CompanyEvent {
    id: string;
    date: string;               // ISO Date String
    type: 'EARNINGS_RELEASE' | 'EARNINGS_CALL' | 'DIVIDEND' | 'SPLIT' | 'OTHER';
    title: string;
    description: string;
    isConfirmed: boolean;
    data?: {                    // NEW: Structured data for DB sync
        eps?: number;
        dividend?: number;
    };
}

export const MarketDataService = {

    // ===========================================
    // CALENDAR EVENTS (v2.2.0)
    // ===========================================
    async getCalendarEvents(ticker: string): Promise<CompanyEvent[]> {
        const cacheKey = "calendar:" + ticker.toUpperCase();
        try {
            // Check cache (reuse Fundamentals TTL of 14 days is too long, maybe 24h?)
            // Using PROFILE TTL (24h) for now as events don't change hourly
            const cached = await getFromCache<CompanyEvent[]>(cacheKey);
            if (cached !== null) return cached;

            const summary = await yahooFinance.quoteSummary(ticker, {
                modules: ['calendarEvents', 'earnings', 'summaryDetail']
            });

            if (!summary) return [];

            const events: CompanyEvent[] = [];
            const ce = summary.calendarEvents;
            const earn = summary.earnings;
            const sd = summary.summaryDetail;

            if (ce) {
                // 1. Next Earnings Date (Confirmed)
                if (ce.earnings && ce.earnings.earningsDate && ce.earnings.earningsDate.length > 0) {
                    const date = ce.earnings.earningsDate[0];
                    // Create normalized EPS value safely
                    let epsVal: number | undefined = undefined;
                    if (ce.earnings.earningsAverage) {
                        epsVal = typeof ce.earnings.earningsAverage === 'object' ? (ce.earnings.earningsAverage.raw || 0) : ce.earnings.earningsAverage;
                    }

                    events.push({
                        id: `earn-${date.getTime()}`,
                        date: date.toISOString(),
                        type: 'EARNINGS_RELEASE',
                        title: 'Resultados (Próximos)',
                        description: `Publicación oficial de resultados. Estimación: ${epsVal !== undefined ? epsVal : 'N/A'}`,
                        isConfirmed: true,
                        data: { eps: epsVal }
                    });

                    // 2. Earnings Call (Presentation)
                    if (ce.earnings.earningsCallDate && ce.earnings.earningsCallDate.length > 0) {
                        const callDate = ce.earnings.earningsCallDate[0];
                        // Only add if significantly different from release date (e.g. > 1 hour diff)
                        if (Math.abs(callDate.getTime() - date.getTime()) > 3600000) {
                            events.push({
                                id: `call-${callDate.getTime()}`,
                                date: callDate.toISOString(),
                                type: 'EARNINGS_CALL',
                                title: 'Conferencia Inversores',
                                description: 'Presentación de resultados ante analistas e inversores.',
                                isConfirmed: true
                            });
                        }
                    }
                }

                // 3. Next Dividend (Confirmed)
                if (ce.exDividendDate) {
                    const divRate = sd?.dividendRate || undefined;
                    events.push({
                        id: `div-ex-${ce.exDividendDate.getTime()}`,
                        date: ce.exDividendDate.toISOString(),
                        type: 'DIVIDEND',
                        title: 'Ex-Dividendo',
                        description: `Fecha límite para tener acciones y cobrar.`,
                        isConfirmed: true,
                        data: { dividend: divRate }
                    });
                }
                if (ce.dividendDate) {
                    events.push({
                        id: `div-pay-${ce.dividendDate.getTime()}`,
                        date: ce.dividendDate.toISOString(),
                        type: 'DIVIDEND',
                        title: 'Pago Dividendo',
                        description: `Fecha de pago efectivo del dividendo.`,
                        isConfirmed: true
                    });
                }
            }

            // 4. Future Earnings Projections (Estimations)
            if (earn && earn.earningsChart && earn.earningsChart.quarterly) {
                // Get the last known date from the quarterly history to start projecting
                const quarters = earn.earningsChart.quarterly;
                // Sort by date just in case
                // quarters.sort((a, b) => a.date - b.date); 

                // Find the latest historical quarter
                const lastQ = quarters[quarters.length - 1];
                let lastDate = lastQ && lastQ.date ? new Date(lastQ.date) : new Date();

                // If the "Next Earnings Date" (Confirmed) is already ahead, use that as base
                const confirmedNext = events.find(e => e.type === 'EARNINGS_RELEASE');
                if (confirmedNext) {
                    lastDate = new Date(confirmedNext.date);
                }

                // Project next 3 quarters (approx 90 days each)
                for (let i = 1; i <= 3; i++) {
                    // Add ~91 days
                    const nextDate = new Date(lastDate);
                    nextDate.setDate(nextDate.getDate() + (91 * i));

                    events.push({
                        id: `earn-est-${nextDate.getTime()}`,
                        date: nextDate.toISOString(),
                        type: 'EARNINGS_RELEASE',
                        title: `Resultados (Estimado)`,
                        description: `Fecha proyectada basada en trimestre fiscal.`,
                        isConfirmed: false
                    });
                }
            }

            // Sort by Date
            events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            // Filter out past events (allow generous 24h buffer just in case)
            const now = new Date();
            now.setHours(now.getHours() - 24);
            const futureEvents = events.filter(e => new Date(e.date) > now);

            await setCache(cacheKey, futureEvents, TTL.PROFILE); // 24h Cache
            return futureEvents;

        } catch (e) {
            console.error(`[MarketData] Calendar Error for ${ticker}:`, e);
            return [];
        }
    },

    // Nueva función para el Crawler de Descubrimiento (Yahoo Screener)
    async getDiscoveryCandidates(scrId: string, count: number = 25, region?: string, targetCurrency?: string, targetSector?: string): Promise<DiscoveryItem[]> {
        try {
            const regionLog = region || 'US';
            console.log(`[MarketData] Obteniendo candidatos para ${scrId} (Región: ${regionLog}, Divisa: ${targetCurrency || 'N/A'}, Sector: ${targetSector || 'N/A'})...`);

            let quotes: any[] = [];

            const queryOptions: any = {
                scrIds: scrId as any,
                count: count
            };

            if (region && region !== 'US') {
                queryOptions.region = region;
                console.log(`[MarketData] Usando Screener con filtro de región: ${region}`);
            }

            try {
                // Llamada unificada al Screener de Yahoo
                const result = await yahooFinance.screener(queryOptions);

                if (result && result.quotes) {
                    quotes = result.quotes;
                    console.log(`[MarketData] Screener RAW encontró ${quotes.length} candidatos en ${regionLog}`);

                    // --- FILTRO DE SOBERANÍA (SOVEREIGNTY FILTER) ---
                    if (targetCurrency) {
                        const preFilter = quotes.length;
                        if (targetCurrency === 'GBP') {
                            quotes = quotes.filter(q => q.currency === 'GBP' || q.currency === 'GBp');
                        } else {
                            quotes = quotes.filter(q => q.currency === targetCurrency);
                        }
                        console.log(`[MarketData] Filtro Divisa (${targetCurrency}): ${preFilter} -> ${quotes.length} items`);
                    }

                    if (targetSector) {
                        const preFilter = quotes.length;
                        quotes = quotes.filter(q => q.sector && q.sector.toLowerCase().includes(targetSector.toLowerCase()));
                        console.log(`[MarketData] Filtro Sector (${targetSector}): ${preFilter} -> ${quotes.length} items`);
                    }
                }
            } catch (e: any) {
                console.error(`[MarketData] Error en Screener para ${scrId} (${regionLog}):`, e.message);
            }

            if (quotes.length === 0) return [];

            // ENRICHMENT: Fetch full quote data to get Target Price, etc.
            const symbols = quotes.map((q: any) => q.symbol);
            let enriched: any[] = [];
            try {
                enriched = await yahooFinance.quote(symbols);
            } catch (e) {
                console.warn('[MarketData] Failed to enrich discovery candidates, using raw screener data.');
            }

            return quotes.map((q: any) => {
                const full = enriched.find(e => e.symbol === q.symbol) || {};

                // Use enriched data if available, fallback to screener
                const price = full.regularMarketPrice || q.regularMarketPrice || 0;

                // Normalization Logic for Discovery (Crawler)
                const target = full.targetMeanPrice || full.targetMedianPrice || full.financialData?.targetMeanPrice?.raw || full.defaultKeyStatistics?.targetMeanPrice?.raw || 0;
                const recs = full.recommendationKey || full.financialData?.recommendationKey || full.averageAnalystRating || 'none';

                // Fair Value Calculation (Graham Number) - v2.3.1
                // Formula: Sqrt(22.5 * EPS * BookValue)
                let fairValue = 0;
                const eps = full.defaultKeyStatistics?.trailingEps?.raw || full.earnings?.trailing || 0;
                const bookValue = full.defaultKeyStatistics?.bookValue?.raw || 0;
                if (eps > 0 && bookValue > 0) {
                    fairValue = Math.sqrt(22.5 * eps * bookValue);
                }

                const mcap = full.marketCap || q.marketCap || 0;

                // Calculate RSI (Basic proxy or 50) - Real RSI needs history, expensive here.
                // We'll stick to 50 but we have Trend.

                return {
                    t: q.symbol,
                    n: q.shortName || q.longName || q.symbol,
                    s: q.sector || 'Unknown',
                    p: price,
                    chg_1d: full.regularMarketChangePercent || q.regularMarketChangePercent || 0,
                    chg_1w: q.fiftyTwoWeekChangePercent ? q.fiftyTwoWeekChangePercent / 52 : undefined,
                    vol_rel: (full.averageDailyVolume3Month) ? (full.regularMarketVolume / full.averageDailyVolume3Month) : 1,
                    tech: {
                        rsi: 50,
                        trend: (full.regularMarketChangePercent || 0) > 0 ? 'Bullish' : 'Bearish',
                        sma50_diff: (full.fiftyDayAverageChangePercent || 0) * 100
                    },
                    fund: {
                        mcap: mcap ? (mcap / 1e9).toFixed(2) + 'B' : 'N/A',
                        recs: recs,
                        target: target
                    },
                    // Root Normalization for Easy SQL Access
                    targetPrice: target,
                    recommendationKey: recs,
                    fairValue: fairValue > 0 ? fairValue : undefined
                };
            });

        } catch (e: any) {
            console.error(`[MarketData] Crawler Error for ${scrId}:`, e.message);
            return [];
        }
    },

    /**
     * Enrich items with missing sector data using quoteSummary
     */
    async enrichSectors(items: DiscoveryItem[]): Promise<DiscoveryItem[]> {
        const unknownItems = items.filter(i => i.s === 'Unknown' || !i.s);
        if (unknownItems.length === 0) return items;

        console.log(`[MarketData] Buscando sector para ${unknownItems.length} items desconocidos...`);

        // Process in chunks of 10 to avoid rate limits
        const chunk = 10;
        for (let i = 0; i < unknownItems.length; i += chunk) {
            const batch = unknownItems.slice(i, i + chunk);
            await Promise.all(batch.map(async (item) => {
                try {
                    const summary = await yahooFinance.quoteSummary(item.t, { modules: ['assetProfile'] });
                    if (summary.assetProfile && summary.assetProfile.sector) {
                        item.s = summary.assetProfile.sector;
                    }
                } catch (e) {
                    // Ignore errors, keep as Unknown
                }
            }));
            // Small delay between chunks
            if (i + chunk < unknownItems.length) await new Promise(r => setTimeout(r, 1000));
        }

        return items;
    },

    /**
     * Get sectors for a list of tickers (with Caching)
     */
    async getSectors(tickers: string[]): Promise<Record<string, string>> {
        const result: Record<string, string> = {};
        const missing: string[] = [];

        // 1. Check Cache
        await Promise.all(tickers.map(async (t) => {
            const cacheKey = "sector:" + t.toUpperCase();
            const cached = await getFromCache<string>(cacheKey);
            if (cached) {
                result[t] = cached;
            } else {
                missing.push(t);
            }
        }));

        if (missing.length === 0) return result;

        console.log(`[MarketData] Fetching sectors for ${missing.length} tickers...`);

        // 2. Fetch Missing (Chunked 5 parallel)
        const chunk = 5;
        for (let i = 0; i < missing.length; i += chunk) {
            const batch = missing.slice(i, i + chunk);
            await Promise.all(batch.map(async (t) => {
                try {
                    const summary = await yahooFinance.quoteSummary(t, { modules: ['assetProfile'] });
                    const sector = summary.assetProfile?.sector || 'Unknown';
                    result[t] = sector;

                    // Cache it
                    const cacheKey = "sector:" + t.toUpperCase();
                    await setCache(cacheKey, sector, TTL.PROFILE);
                } catch (e) {
                    console.warn(`[MarketData] Sector fetch failed for ${t}`);
                    result[t] = 'Unknown';
                    // Cache negative result briefly (1 hour) to avoid retry loop
                    const cacheKey = "sector:" + t.toUpperCase();
                    await setCache(cacheKey, 'Unknown', 60 * 60 * 1000);
                }
            }));
            // Small delay to be nice to API
            if (i + chunk < missing.length) await new Promise(r => setTimeout(r, 500));
        }

        return result;
    },


    // Finnhub Discovery (News-based Ticker Extraction)
    async getDiscoveryCandidatesFinnhub(category: string, count: number = 25): Promise<DiscoveryItem[]> {
        const finnhubKey = process.env.FINNHUB_API_KEY;
        if (!finnhubKey) return [];

        try {
            console.log(`[MarketData] Finnhub Discovery for ${category}...`);

            // Step 1: Get Candidate Tickers via Yahoo
            const map: Record<string, string> = {
                'technology': 'growth_technology_stocks',
                'business': 'most_actives',
                'general': 'day_gainers'
            };
            const targetScreener = map[category] || 'day_gainers';

            console.log(`[MarketData] Finnhub: Fetching candidates using backup source (${targetScreener})...`);

            // Randomness Strategy: Fetch 3x the candidates, shuffle them, and pick the requested amount.
            // This ensures variety (Random Top 60) instead of always the same Top 20.
            const poolSize = 60;
            const candidatesPool = await this.getDiscoveryCandidates(targetScreener, poolSize);

            // Shuffle
            const shuffled = candidatesPool.sort(() => 0.5 - Math.random());

            // Respect Finnhub Rate Limit (Limit final selection to 20 for now)
            const limit = Math.min(count, 20);
            const selectedCandidates = shuffled.slice(0, limit);

            const tickers = selectedCandidates.map(c => c.t);

            if (tickers.length === 0) return [];

            // Step 2: Fetch Quotes from Finnhub
            console.log(`[MarketData] Finnhub: Fetching real-time quotes for ${tickers.length} tickers...`);
            const results: DiscoveryItem[] = [];

            await Promise.all(tickers.map(async (t) => {
                try {
                    const qUrl = `https://finnhub.io/api/v1/quote?symbol=${t}&token=${finnhubKey}`;
                    const qRes = await fetch(qUrl);
                    if (qRes.ok) {
                        const qData = await qRes.json();
                        if (qData.c) {
                            results.push({
                                t: t,
                                n: t,
                                s: 'N/A',
                                p: Number(qData.c),
                                chg_1d: Number(qData.dp),
                                chg_1w: 0,
                                vol_rel: 1,
                                source: 'Finnhub'
                            });
                        }
                    }
                } catch (e) { }
            }));

            // Restore Names
            return results.map(r => {
                const yC = candidatesPool.find(c => c.t === r.t);
                return {
                    ...r,
                    n: yC ? yC.n : r.n,
                    s: yC ? yC.s : r.s
                };
            });

        } catch (e) {
            console.error(`[MarketData] Finnhub Discovery Error (${category}):`, e);
            return [];
        }
    },

    // Buscar símbolos usando fetch directo
    async searchSymbols(query: string): Promise<SymbolSearchResult[]> {
        if (!query || query.length < 1) return [];

        try {
            const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0&enableFuzzyQuery=false`;
            const response = await fetch(url);

            if (!response.ok) return [];

            const data = await response.json();
            const quotes = data.quotes || [];

            // Same sorting logic
            const getPriority = (q: any) => {
                const symbol = (q.symbol || '').toUpperCase();
                const exc = (q.exchange || '').toUpperCase();
                if (symbol.endsWith('.MC') || exc === 'MCE' || exc === 'MAD' || exc === 'BME') return 3;
                const usaExchanges = ['NMS', 'NYQ', 'NGM', 'ASE', 'PNK', 'NCM', 'NYE', 'NAS'];
                if (usaExchanges.includes(exc) || !symbol.includes('.')) return 2;
                return 1;
            };

            const sortedQuotes = quotes.sort((a: any, b: any) => {
                return getPriority(b) - getPriority(a);
            });

            const filteredQuotes = sortedQuotes.filter((q: any) => q.quoteType === 'EQUITY' || q.quoteType === 'ETF');
            const symbols = filteredQuotes.slice(0, 10).map((q: any) => q.symbol);

            if (symbols.length === 0) return [];

            // Enriquecimiento: Obtener datos reales (moneda, nombre oficial) en una sola llamada
            let enrichedData: any[] = [];
            try {
                enrichedData = await yahooFinance.quote(symbols);
            } catch (err) {
                console.error('Search Enrichment Error:', err);
            }

            return filteredQuotes.slice(0, 10).map((q: any) => {
                const realData = enrichedData.find(ed => ed.symbol === q.symbol);
                let currency = realData?.currency || q.currency;

                // Normalización GBX centralizada
                if (currency === 'GBp') {
                    currency = 'GBX';
                } else if (currency === 'GBP' && (realData?.exchange === 'LSE' || q.symbol.endsWith('.L'))) {
                    currency = 'GBX';
                }

                return {
                    symbol: q.symbol,
                    name: realData?.shortName || q.shortname || q.longname || q.symbol,
                    exchange: realData?.exchange || q.exchange,
                    type: q.quoteType,
                    currency: currency
                };
            });
        } catch (e) {
            console.error('Yahoo Search Error', e);
            return [];
        }
    },

    async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number | null> {
        if (fromCurrency === toCurrency) return 1.0;

        const cacheKey = "rate:" + fromCurrency + ":" + toCurrency;
        const cached = await getFromCache<number>(cacheKey);
        if (cached !== null) {
            return cached;
        }

        try {
            // Support for GBX (Penny Sterling) - Convert to GBP
            let from = fromCurrency;
            let to = toCurrency;
            let multiplier = 1.0;

            if (from === 'GBX') { from = 'GBP'; multiplier *= 0.01; }
            if (to === 'GBX') { to = 'GBP'; multiplier *= 100.0; }

            const symbol = from + to + "=X";

            // Reuse getQuote logic since it fetches the same chart data
            const quote = await this.getQuote(symbol);

            if (quote && quote.c) {
                const finalRate = quote.c * multiplier;
                await setCache(cacheKey, finalRate, TTL.EXCHANGE_RATE);
                return finalRate;
            }
            return null;
        } catch (e) {
            console.error('Exchange Rate Error', e);
            return null;
        }
    },
    // Obtener cotización usando fetch directo a Yahoo API V8 (bypass library)
    async getQuote(ticker: string): Promise<QuoteResult | null> {
        const cacheKey = "quote:" + ticker.toUpperCase();
        const cached = await getFromCache<QuoteResult>(cacheKey);
        if (cached !== null) {
            return cached;
        }

        try {
            // Yahoo Finance V8 Chart API is robust for current price stats
            const url = "https://query1.finance.yahoo.com/v8/finance/chart/" + ticker + "?interval=1d&range=1d";
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
                }
            });

            if (!response.ok) {
                console.error(`Yahoo API Fetch Error ${response.status} for ${ticker}: ${response.statusText} `);
                return null;
            }

            const data = await response.json();
            const meta = data.chart?.result?.[0]?.meta;

            if (!meta) {
                console.error(`No meta data in Yahoo response for ${ticker}`);
                return null;
            }

            // Determine market state
            let marketState = 'CLOSED';
            if (meta.marketState) {
                marketState = meta.marketState.toUpperCase();
            } else if (meta.currentTradingPeriod) {
                const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
                const ctp = meta.currentTradingPeriod;

                const regStart = ctp.regular?.start || 0;
                const regEnd = ctp.regular?.end || 0;
                const preStart = ctp.pre?.start || 0;
                const postEnd = ctp.post?.end || 0;

                if (now >= regStart && now <= regEnd) {
                    marketState = 'REGULAR';
                } else if (now >= preStart && now < regStart) {
                    marketState = 'PRE';
                } else if (now > regEnd && now <= postEnd) {
                    marketState = 'POST';
                }
            }

            let currency = meta.currency || 'USD';

            // Normalización para Londres/GBX
            // Yahoo devuelve 'GBP' para LSE, pero si el precio está en el rango de los cientos/miles es casi siempre peniques (GBX)
            if (currency === 'GBp') {
                currency = 'GBX';
            } else if (currency === 'GBP' && (meta.exchangeName === 'LSE' || ticker.endsWith('.L'))) {
                // Heurística: si es LSE y el precio es > 5 (raro ver una acción de < 1 p en GBP en Yahoo) suele ser GBX
                currency = 'GBX';
            }

            const result: QuoteResult = {
                c: meta.regularMarketPrice || 0,
                pc: meta.chartPreviousClose || meta.previousClose || 0,
                d: (meta.regularMarketPrice || 0) - (meta.chartPreviousClose || 0),
                dp: 0, // calculate percentage manually
                currency: currency,
                name: meta.longName || meta.shortName || meta.symbol,
                volume: meta.regularMarketVolume || 0,
                lastUpdated: Date.now(),
                state: marketState,
                exchange: meta.exchangeName || 'UNKNOWN',
                yearLow: meta.fiftyTwoWeekLow,
                yearHigh: meta.fiftyTwoWeekHigh
            };

            // Calculate change percent
            if (result.pc !== 0) {
                result.dp = (result.d / result.pc) * 100;
            }

            await setCache(cacheKey, result, TTL.QUOTE);
            return result;
        } catch (e) {
            console.error(`Quote Error for ${ticker}: `, e);
            return null;
        }
    },

    // ===========================================
    // FUNDAMENTAL DATA (v2.2.0)
    // ===========================================
    async getFundamentals(ticker: string): Promise<FundamentalData | null> {
        const cacheKey = "fundamentals:" + ticker.toUpperCase();
        // Skip cache for now to ensure we get EXTENDED data if it wasn't there before. 
        // Ideally we should version the cache key or check if extended exists.
        // const cached = await getFromCache<FundamentalData>(cacheKey);
        // if (cached !== null && cached.extended) { return cached; } // Only return if extended exists

        try {
            // Updated list of modules for Deep Analysis (Crawler Persistence)
            const modules = [
                'summaryDetail', 'defaultKeyStatistics', 'financialData', 'calendarEvents', 'price',
                'incomeStatementHistory', 'balanceSheetHistory', 'cashflowStatementHistory', 'earnings'
            ] as any;

            const summary = await yahooFinance.quoteSummary(ticker, { modules });
            if (!summary) return null;

            const fd = summary.financialData;
            const ks = summary.defaultKeyStatistics;
            const sd = summary.summaryDetail;
            const ce = summary.calendarEvents;
            // const price = summary.price;

            if (!fd || !sd) return null;

            // Helper para extraer raw values de forma segura
            const val = (obj: any) => (obj && typeof obj === 'object' && 'raw' in obj) ? (obj.raw || 0) : (obj || 0);
            const fmt = (obj: any) => (obj && typeof obj === 'object' && 'fmt' in obj) ? obj.fmt : null;

            // EXTENDED DATA MAPPING (Shared logic with getEnhancedQuoteData)
            const extended: Record<string, any> = {};
            const flatten = (obj: any, prefix = '') => {
                if (!obj || typeof obj !== 'object') return;
                Object.keys(obj).forEach(key => {
                    const value = obj[key];
                    const newKey = prefix ? `${prefix}_${key}` : key;
                    if (value && typeof value === 'object' && 'raw' in value) {
                        extended[newKey] = value.raw;
                    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                        if (key !== 'maxAge' && key !== 'endDate') flatten(value, newKey);
                    } else if (value !== null && value !== undefined && typeof value !== 'function') {
                        extended[newKey] = value;
                    }
                });
            };

            if (summary.financialData) flatten(summary.financialData, 'fin');
            if (summary.defaultKeyStatistics) flatten(summary.defaultKeyStatistics, 'stat');
            if (summary.incomeStatementHistory?.incomeStatementHistory?.[0]) flatten(summary.incomeStatementHistory.incomeStatementHistory[0], 'inc');
            if (summary.balanceSheetHistory?.balanceSheetStatements?.[0]) flatten(summary.balanceSheetHistory.balanceSheetStatements[0], 'bal');
            if (summary.cashflowStatementHistory?.cashflowStatements?.[0]) flatten(summary.cashflowStatementHistory.cashflowStatements[0], 'cf');

            // Save RAW summary for re-hydration in getEnhancedQuoteData
            extended['_raw'] = summary;


            // Verify and normalize Target Price logic:
            // 1. FinancialData.targetMeanPrice (Most reliable for Consensus)
            // 2. DefaultKeyStatistics (Sometimes has it)
            // 3. SummaryDetail (Sometimes has it)
            const rawTarget = val(fd.targetMeanPrice) || val(fd.targetMedianPrice) || val(sd.targetMeanPrice);
            const rawRecs = fd.recommendationKey || fd.recommendationMean || 'none';

            // Fair Value (Graham Number)
            let fairValue = 0;
            const eps = val(ks.trailingEps);
            const bookValue = val(ks.bookValue);
            if (eps > 0 && bookValue > 0) {
                fairValue = Math.sqrt(22.5 * eps * bookValue);
            }

            const data: FundamentalData = {
                // Normalized Fields
                targetPrice: rawTarget,
                recommendationKey: typeof rawRecs === 'string' ? rawRecs : undefined,
                fairValue: fairValue > 0 ? fairValue : undefined,

                // Valuation
                marketCap: val(sd.marketCap),
                enterpriseValue: val(ks?.enterpriseValue),
                trailingPE: val(sd.trailingPE),
                forwardPE: val(sd.forwardPE),
                pegRatio: val(ks?.pegRatio),
                priceToSales: val(sd.priceToSalesTrailing12Months),
                priceToBook: val(ks?.priceToBook),

                // Profitability
                profitMargins: val(fd.profitMargins),
                operatingMargins: val(fd.operatingMargins),
                grossMargins: val(fd.grossMargins), // NEW
                ebitdaMargins: val(fd.ebitdaMargins), // NEW
                returnOnEquity: val(fd.returnOnEquity),
                returnOnAssets: val(fd.returnOnAssets),

                // Growth
                revenueGrowth: val(fd.revenueGrowth), // NEW
                earningsGrowth: val(fd.earningsGrowth), // NEW

                // Financials & Cash Flow
                totalRevenue: val(fd.totalRevenue),
                ebitda: val(fd.ebitda),
                totalCash: val(fd.totalCash),
                totalDebt: val(fd.totalDebt),
                debtToEquity: val(fd.debtToEquity),
                currentRatio: val(fd.currentRatio),
                quickRatio: val(fd.quickRatio), // NEW
                freeCashflow: val(fd.freeCashflow), // NEW
                operatingCashflow: val(fd.operatingCashflow), // NEW

                // Per Share
                trailingEps: val(ks?.trailingEps), // Sometimes in defaultKeyStatistics
                forwardEps: val(ks?.forwardEps),
                bookValue: val(ks?.bookValue),
                revenuePerShare: val(fd.revenuePerShare), // NEW
                totalCashPerShare: val(fd.totalCashPerShare), // NEW

                // Dividends
                dividendRate: val(sd.dividendRate),
                dividendYield: val(sd.dividendYield),
                payoutRatio: val(sd.payoutRatio),
                exDividendDate: fmt(sd.exDividendDate) || 'N/A',

                // Structure & Sentiment
                heldPercentInstitutions: val(ks?.heldPercentInstitutions), // NEW
                heldPercentInsiders: val(ks?.heldPercentInsiders), // NEW
                shortRatio: val(ks?.shortRatio), // NEW

                extended: extended // SEND EVERYTHING for persistence
            };

            await setCache(cacheKey, data, TTL.FUNDAMENTALS);
            return data;

        } catch (e) {
            console.error(`[MarketData] Fundamentals Error for ${ticker}: `, e);
            return null;
        }
    },

    // Obtener perfil del activo (sector/industria) - Motor Personal (Discovery) -> Finnhub -> Yahoo (Library)
    async getAssetProfile(ticker: string) {
        const cacheKey = `profile:${ticker.toUpperCase()}`;
        const cached = await getFromCache<any>(cacheKey);
        if (cached !== null) return cached;

        // 1. MOTOR PERSONAL: Buscar en el cache de descubrimiento (Discovery Engine)
        try {
            const discResult = await sql`
                SELECT sector FROM (
                    SELECT jsonb_array_elements(data)->>'t' as t, jsonb_array_elements(data)->>'s' as sector
                    FROM market_discovery_cache
                ) sub WHERE t = ${ticker.toUpperCase()} LIMIT 1
            `;
            if (discResult.length > 0 && discResult[0].sector && discResult[0].sector !== 'Unknown') {
                const profile = {
                    sector: discResult[0].sector,
                    industry: discResult[0].sector, // Reuso sector como industria si no hay detalle
                    name: ticker,
                    source: 'Personal Engine'
                };
                await setCache(cacheKey, profile, TTL.PROFILE);
                return profile;
            }
        } catch (e) {
            console.warn(`[Discovery Lookup] Error for ${ticker}:`, e);
        }

        const finnhubKey = process.env.FINNHUB_API_KEY;

        // 2. Finnhub (Secondary) - US Only to avoid Cert Errors
        if (finnhubKey && !ticker.includes('.')) {
            try {
                const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${finnhubKey}`;
                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.finnhubIndustry) {
                        const profile = {
                            sector: data.finnhubIndustry || 'Desconocido',
                            industry: data.finnhubIndustry || 'Desconocido',
                            country: data.country || 'Desconocido',
                            website: data.weburl || null,
                            name: data.name || ticker,
                            logo: data.logo || null,
                            source: 'Finnhub'
                        };
                        await setCache(cacheKey, profile, TTL.PROFILE);
                        return profile;
                    }
                }
            } catch (e) { }
        }

        // 3. Fallback to Yahoo Library (More robust than raw fetch)
        try {
            const summary = await yahooFinance.quoteSummary(ticker, { modules: ['summaryProfile', 'price'] });
            if (summary && summary.summaryProfile) {
                const profile = {
                    sector: summary.summaryProfile.sector || 'Desconocido',
                    industry: summary.summaryProfile.industry || 'Desconocido',
                    country: summary.summaryProfile.country || 'Desconocido',
                    name: summary.price?.longName || summary.price?.shortName || ticker,
                    source: 'Yahoo Library'
                };
                await setCache(cacheKey, profile, TTL.PROFILE);
                return profile;
            }
        } catch (e) {
            console.error(`Asset Profile Fallback Error for ${ticker}:`, e);
        }

        return {
            sector: 'Desconocido',
            industry: 'Desconocido',
            country: 'Desconocido',
            source: 'None'
        };
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
                sector: profile?.sector || 'Desconocido',
                industry: profile?.industry || 'Desconocido'
            };
        } catch (e) {
            console.error(`QuoteWithProfile Error for ${ticker}:`, e);
            return null;
        }
    },

    // Obtener noticias combinadas de Investing.com (Bolsa, Tecnología, Titulares)
    async getNews(ticker: string) {
        try {
            const feeds = [
                { url: 'https://es.investing.com/rss/news_25.rss', label: 'Bolsa' },
                { url: 'https://es.investing.com/rss/news.rss', label: 'Titulares' }, // "Todas las noticias" as Headlines fallback
                { url: 'https://es.investing.com/rss/news_288.rss', label: 'Tecnología' }
            ];

            const promises = feeds.map(async (feed) => {
                try {
                    const response = await fetch(feed.url, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                        }
                    });

                    if (!response.ok) return [];
                    const xmlText = await response.text();

                    const items: any[] = [];
                    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
                    const matches = xmlText.match(itemRegex);

                    if (matches) {
                        for (let i = 0; i < matches.length; i++) {
                            const itemXml = matches[i];

                            const titleMatch = itemXml.match(/<title>(.*?)<\/title>/);
                            const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
                            const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
                            const sourceMatch = itemXml.match(/<author>(.*?)<\/author>/);
                            const enclosureMatch = itemXml.match(/<enclosure[^>]*url="([^"]+)"/);

                            let title = titleMatch ? titleMatch[1] : '';
                            title = title.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '');

                            const url = linkMatch ? linkMatch[1] : '';
                            const pubDateStr = pubDateMatch ? pubDateMatch[1] : '';
                            let source = sourceMatch ? sourceMatch[1] : 'Investing.com';

                            let image = '';
                            if (enclosureMatch && enclosureMatch[1]) {
                                image = enclosureMatch[1];
                            }

                            // Use raw string for sorting as requested (works for YYYY-MM-DD HH:mm:ss)
                            const rawDate = pubDateStr || '';

                            // Best-effort timestamp for frontend display
                            let datetime = Math.floor(Date.now() / 1000);
                            if (rawDate) {
                                // Simple parse attempt, fallback to now
                                const millis = Date.parse(rawDate.replace(' ', 'T'));
                                if (!isNaN(millis)) datetime = Math.floor(millis / 1000);
                            }

                            if (title && url) {
                                items.push({
                                    id: Date.now() + Math.random(),
                                    headline: title,
                                    url: url,
                                    datetime: datetime, // For frontend display
                                    rawDate: rawDate,   // For backend sorting
                                    source: source,
                                    summary: title,
                                    image: image,
                                    category: 'finance',
                                    related: feed.label
                                });
                            }
                        }
                    }
                    return items;
                } catch (err) {
                    console.error(`Error fetching feed ${feed.label}:`, err);
                    return [];
                }
            });

            // Wait for all feeds
            const results = await Promise.all(promises);
            const allItems = results.flat();

            // Deduplicate by URL
            const uniqueItems: any[] = [];
            const seenUrls = new Set();
            for (const item of allItems) {
                if (!seenUrls.has(item.url)) {
                    seenUrls.add(item.url);
                    uniqueItems.push(item);
                }
            }

            // Sort by date desc
            return uniqueItems.sort((a, b) => b.datetime - a.datetime).slice(0, 30); // Return top 30
        } catch (e) {
            console.error('Error fetching generic news:', e);
            return [];
        }
    },

    async getCompanyNews(query: string) {
        if (!query) return [];
        try {
            // 1. Try to get Company Name for better search (especially for .MC, .DE)
            let companyName = "";
            try {
                // Use getQuote (V8) instead of getAssetProfile (V10, flaky)
                const quote = await this.getQuote(query);
                if (quote && quote.name && quote.name !== query) {
                    // Clean legal suffixes for better news search
                    // e.g. "Amper, S.A." -> "Amper"
                    let clean = quote.name.split(',')[0].trim(); // Remove ", S.A."
                    clean = clean.replace(/\b(S\.?A\.?|S\.?L\.?|S\.?A\.?U\.?|PLC|N\.?V\.?|AG|SE|INC\.?|CORP\.?|LTD\.?|CO\.?|B\.?V\.?|GMBH|S\.?R\.?L\.?|S\.?P\.?A\.?)\b/gi, '').trim();
                    if (clean.length > 2) {
                        companyName = clean;
                    }
                }
            } catch (ignore) { }

            // 2. Use the robust NewsService
            const newsItems = await NewsService.getNews(query, companyName);

            return newsItems.map(n => ({
                title: n.headline,
                link: n.url,
                publisher: n.source,
                time: n.datetime * 1000,
                timeStr: new Date(n.datetime * 1000).toLocaleString('es-ES', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                })
            }));
        } catch (e) {
            console.error(`Error searching news for ${query}:`, e);
            return [];
        }
    },


    // Estado de mercados usando Yahoo Finance V10 (quoteSummary)
    // Reemplaza a Finnhub para mayor fiabilidad y uso de la API V10 solicitada
    // 
    // OPTIMIZACIÓN v2.3.0: Cache server-side
    // - Solo 1 llamada a Yahoo cada 60 segundos (independiente del número de clientes)
    // - Todos los navegadores/tabs reciben datos del cache instantáneamente
    async getMarketStatus(indices: string[]) {
        // Check if we have valid cached data
        const now = Date.now();
        const indicesKey = indices.sort().join(',');

        if (marketStatusCache &&
            (now - marketStatusCache.updatedAt) < MARKET_STATUS_TTL &&
            marketStatusCache.indices.sort().join(',') === indicesKey) {
            // Return cached data (no Yahoo call)
            return marketStatusCache.data;
        }

        // Fetch fresh data from Yahoo
        try {
            console.log(`[MarketStatus] Refreshing cache for ${indices.length} indices via Yahoo V10...`);

            // Yahoo V10 (quoteSummary) no soporta batching nativo como V7 (quote),
            // así que iteramos con Promise.all.
            const results = await Promise.all(indices.map(async (symbol) => {
                try {
                    // quoteSummary es la API V10
                    const summary = await yahooFinance.quoteSummary(symbol, { modules: ['price'] });
                    const price = summary.price;

                    if (!price) {
                        return {
                            symbol,
                            name: symbol,
                            state: 'UNKNOWN',
                            exchangeName: 'UNKNOWN'
                        };
                    }

                    // Mapeo de estados de Yahoo a nuestro formato
                    // Yahoo marketState: 'PRE', 'REGULAR', 'POST', 'CLOSED', 'PREPRE', 'POSTPOST', etc.
                    // Frontend espera el estado CRUDO para pintar los colores correctamente
                    const state = price.marketState || 'CLOSED';

                    // Nombres amigables para exchanges comunes
                    let exchangeName = price.exchangeName || 'UNKNOWN';
                    if (symbol === '^IBEX') exchangeName = 'BME';
                    if (symbol === '^GDAXI') exchangeName = 'XETRA';
                    if (symbol === '^FTSE') exchangeName = 'LSE';
                    if (symbol === '^DJI') exchangeName = 'NYSE';
                    if (symbol === '^IXIC') exchangeName = 'NASDAQ';

                    return {
                        symbol,
                        name: price.shortName || price.longName || symbol,
                        state: state, // 'REGULAR', 'CLOSED', 'PRE', 'POST'
                        exchangeName: exchangeName,
                        // Info extra útil
                        marketState: price.marketState
                    };

                } catch (err) {
                    console.error(`[MarketStatus] Error fetching ${symbol}:`, err);
                    return { symbol, name: symbol, state: 'CLOSED', exchangeName: 'Unknown' };
                }
            }));

            // Update cache
            marketStatusCache = {
                data: results,
                updatedAt: now,
                indices: indices
            };

            return results;

        } catch (e) {
            console.error('[MarketStatus] Global error:', e);
            // Return cached data if available, even if expired
            if (marketStatusCache) {
                console.log('[MarketStatus] Returning stale cache due to error');
                return marketStatusCache.data;
            }
            // Fallback seguro
            return indices.map(symbol => ({
                symbol,
                name: symbol,
                state: 'CLOSED',
                exchangeName: 'UNKNOWN'
            }));
        }
    },

    // Historial de precios usando fetch directo
    async getHistory(ticker: string, range: string = '1mo') {
        try {
            // range: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
            // interval: 1d, 1wk, 1mo
            let interval = '1d';
            if (['6mo', '1y', '2y', '5y', '10y', 'max'].includes(range)) {
                if (range === '6mo' || range === '1y') interval = '1wk'; // Match previous logic
                else interval = '1mo';
            }

            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${interval}&range=${range}`;
            const response = await fetch(url);
            if (!response.ok) return [];

            const data = await response.json();
            const result = data.chart?.result?.[0];

            if (!result || !result.timestamp || !result.indicators?.quote?.[0]) return [];

            const timestamps = result.timestamp;
            const quotes = result.indicators.quote[0];

            const history: any[] = [];
            for (let i = 0; i < timestamps.length; i++) {
                if (quotes.close[i] !== null) {
                    history.push({
                        date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
                        price: quotes.close[i]
                    });
                }
            }
            return history;
        } catch (e) {
            console.error('History Fetch Error', e);
            return [];
        }
    },

    // Buscar Ticker por ISIN
    async getTickerByISIN(isin: string): Promise<string | null> {
        if (!isin) return null;
        try {
            const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${isin}&quotesCount=1`;
            const response = await fetch(url);
            if (!response.ok) return null;
            const data = await response.json();
            const quotes = data.quotes || [];

            if (quotes.length > 0) {
                const equity = quotes.find((q: any) => q.quoteType === 'EQUITY' || q.quoteType === 'ETF');
                return equity ? equity.symbol : quotes[0].symbol;
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
            const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${isin}&quotesCount=1`;
            const response = await fetch(url);
            if (!response.ok) return null;
            const data = await response.json();
            const quotes = data.quotes || [];

            if (quotes.length > 0) {
                const equity = quotes.find((q: any) => q.quoteType === 'EQUITY' || q.quoteType === 'ETF') || quotes[0];

                let currency = (equity as any).currency;

                // Si no hay currency (search a veces no lo da), fetch quote
                if (!currency) {
                    try {
                        const q = await this.getQuote(equity.symbol);
                        if (q) currency = q.currency;
                    } catch (err) { }
                }

                return {
                    symbol: equity.symbol,
                    currency: currency || 'USD',
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

        let symbol = `${fromCurrency}${toCurrency}=X`;
        let invert = false;

        if (toCurrency === 'EUR' && fromCurrency === 'USD') {
            symbol = 'EURUSD=X';
            invert = true;
        } else if (toCurrency === 'USD' && fromCurrency === 'EUR') {
            symbol = 'EURUSD=X';
            invert = false;
        }

        try {
            // Rango de 5d alrededor de la fecha (period1/period2 en segundos)
            const targetTime = Math.floor(date.getTime() / 1000);
            const period1 = targetTime - (3 * 86400);
            const period2 = targetTime + (3 * 86400);

            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d`;
            const response = await fetch(url);

            if (!response.ok) return 1.0;
            const data = await response.json();
            const result = data.chart?.result?.[0];

            if (!result || !result.timestamp || !result.indicators?.quote?.[0]) return 1.0;

            const timestamps = result.timestamp;
            const quotes = result.indicators.quote[0];

            let bestRate = quotes.close[0];
            let minDiff = Number.MAX_VALUE;

            // Find closest date
            for (let i = 0; i < timestamps.length; i++) {
                if (quotes.close[i]) {
                    const diff = Math.abs(targetTime - timestamps[i]);
                    if (diff < minDiff) {
                        minDiff = diff;
                        bestRate = quotes.close[i];
                    }
                }
            }

            if (invert && bestRate) return 1 / bestRate;
            return bestRate || 1.0;

        } catch (e) {
            console.error(`Error fetching historical rate for ${fromCurrency}/${toCurrency} on ${date}:`, e);
            return 1.0;
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
    // CALCULAR INDICADORES TÉCNICOS (RSI, SMA)
    getTechnicalIndicators(prices: number[]) {
        if (!prices || prices.length < 15) return null;

        // prices[0] is oldest, prices[last] is newest (assumed db/yahoo order)
        // Ensure we work with newest at the end

        // 1. RSI (14)
        const rsiPeriod = 14;
        let gains = 0;
        let losses = 0;

        // Calculate initial avg gain/loss
        for (let i = 1; i <= rsiPeriod; i++) {
            const change = prices[i] - prices[i - 1];
            if (change > 0) gains += change;
            else losses += Math.abs(change);
        }

        let avgGain = gains / rsiPeriod;
        let avgLoss = losses / rsiPeriod;

        // Smooth rest
        for (let i = rsiPeriod + 1; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            const currentGain = change > 0 ? change : 0;
            const currentLoss = change < 0 ? Math.abs(change) : 0;

            avgGain = ((avgGain * 13) + currentGain) / 14;
            avgLoss = ((avgLoss * 13) + currentLoss) / 14;
        }

        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));

        // 2. SMA (50, 200)
        const lastPrice = prices[prices.length - 1];

        const calcSMA = (period: number) => {
            if (prices.length < period) return null;
            const slice = prices.slice(-period);
            const sum = slice.reduce((a, b) => a + b, 0);
            return sum / period;
        };

        const sma50 = calcSMA(50);
        const sma200 = calcSMA(200);

        // 3. Trend
        let trend = 'NEUTRAL';
        if (sma50 && sma200) {
            if (lastPrice > sma50 && sma50 > sma200) trend = 'ALCISTA (Fuerte)';
            else if (lastPrice > sma50) trend = 'ALCISTA (Moderada)';
            else if (lastPrice < sma50 && sma50 < sma200) trend = 'BAJISTA (Fuerte)';
            else if (lastPrice < sma50) trend = 'BAJISTA (Moderada)';
        }

        return {
            rsi: parseFloat(rsi.toFixed(2)),
            sma50: sma50 ? parseFloat(sma50.toFixed(2)) : null,
            sma200: sma200 ? parseFloat(sma200.toFixed(2)) : null,
            trend
        };
    },

    // --- FINNHUB INTEGRATION (ADVANCED INSIGHTS) ---
    async getAnalystRecommendations(ticker: string, currency?: string) {
        const apiKey = process.env.FINNHUB_API_KEY;
        if (!apiKey) return null;

        // 1. Check Currency if available (User Request: "Use stored currency")
        if (currency && currency !== 'USD') return null;

        // 2. Fallback Heuristic: International stocks have dots (e.g., .MC, .DE)
        if (!currency && ticker.includes('.')) return null;
        const cacheKey = `analyst:${ticker.toUpperCase()}`;
        const cached = await getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const url = `https://finnhub.io/api/v1/stock/recommendation?symbol=${ticker}&token=${apiKey}`;
            const res = await fetch(url);
            if (!res.ok) return null;
            const data = await res.json();
            const latest = data[0]; // Most recent month
            if (latest) {
                await setCache(cacheKey, latest, TTL.PROFILE); // Cache 24h
                return latest;
            }
        } catch (e) { console.error('Finnhub Rec Error', e); }
        return null;
    },

    async getPeers(ticker: string) {
        const apiKey = process.env.FINNHUB_API_KEY;
        if (!apiKey) return [];
        if (ticker.includes('.')) return [];
        const cacheKey = `peers:${ticker.toUpperCase()}`;
        const cached = await getFromCache<string[]>(cacheKey);
        if (cached) return cached;

        try {
            const url = `https://finnhub.io/api/v1/stock/peers?symbol=${ticker}&token=${apiKey}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                await setCache(cacheKey, data, TTL.PROFILE);
                return data;
            }
        } catch (e) { console.error('Finnhub Peers Error', e); }
        return [];
    },

    async getInsiderSentiment(ticker: string, currency?: string) {
        const apiKey = process.env.FINNHUB_API_KEY;
        if (!apiKey) return null;

        // 1. Check Currency if available
        if (currency && currency !== 'USD') return null;

        // 2. Fallback Heuristic
        if (!currency && ticker.includes('.')) return null;
        // Check cache? Sentiment changes monthly
        try {
            const from = new Date();
            from.setMonth(from.getMonth() - 3); // Last 3 months
            const fromStr = from.toISOString().split('T')[0];

            const url = `https://finnhub.io/api/v1/stock/insider-sentiment?symbol=${ticker}&from=${fromStr}&token=${apiKey}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data.data && data.data.length > 0) {
                    // Aggregate last 3 months
                    const mspr = data.data.reduce((acc: number, curr: any) => acc + curr.mspr, 0);
                    return { mspr, label: mspr > 0 ? 'Positivo' : mspr < 0 ? 'Negativo' : 'Neutral' };
                }
            }
        } catch (e) { console.error('Finnhub Insider Error', e); }
        return null;
    },

    async getKnownTickers(): Promise<string[]> {
        try {
            // Fetch distinct tickers from all relevant tables
            // We use UNION to combine and remove duplicates automatically
            const result = await sql`
                SELECT DISTINCT ticker FROM historical_data WHERE ticker IS NOT NULL
                UNION
                SELECT DISTINCT ticker FROM positions WHERE ticker IS NOT NULL
                UNION
                SELECT DISTINCT ticker FROM watchlists WHERE ticker IS NOT NULL
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

            if (lastDate) {
                const msInYear = 365.25 * 24 * 60 * 60 * 1000;
                // If years requested is small (e.g. 0.084 for 30d), but we need SMA200 later, 
                // we might want to ensure we have at least 1 year in DB if it's not fresh.
                // For now, respect the requested "years" but add a buffer check.

                const cutoffDate = new Date(Date.now() - (years * msInYear));

                // Check coverage in DB
                const dataFromDb = await sql`
                    SELECT date, open, high, low, close, volume 
                    FROM historical_data 
                    WHERE ticker = ${symbol} 
                    AND date >= ${cutoffDate}
                    ORDER BY date ASC
                `;

                // Minimal coverage threshold (e.g. 70% of expected trading days)
                const expectedDays = Math.floor(years * 252 * 0.7);

                if (dataFromDb.length >= expectedDays && new Date(dataFromDb[dataFromDb.length - 1].date) >= thresholdDate) {
                    // Map to plain objects for proper JSON serialization
                    return dataFromDb.map(row => ({
                        date: row.date instanceof Date ? row.date.toISOString() : String(row.date),
                        open: Number(row.open),
                        high: Number(row.high),
                        low: Number(row.low),
                        close: Number(row.close),
                        volume: Number(row.volume)
                    }));
                }

                // If data is stale or insufficient, force fetch 1 year to ensure SMA calculations work
                // ONLY if the requested range is small, upgrading it to 1 year for cache warming.
                if (years < 1) {
                    console.log(`[MarketData] Insufficient or stale data for ${symbol}. Upgrading fetch to 1 year.`);
                    years = 1;
                }
            }

            // 2. Fetch Yahoo Direct
            const period1 = Math.floor((Date.now() - (years * 365.25 * 86400 * 1000)) / 1000);
            const period2 = Math.floor(Date.now() / 1000);

            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Yahoo status ${response.status}`);

            const data = await response.json();
            const result = data.chart?.result?.[0];

            if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
                throw new Error("Yahoo returned empty results");
            }

            const timestamps = result.timestamp;
            const quotes = result.indicators.quote[0];

            const rowsToInsert: any[] = [];
            for (let i = 0; i < timestamps.length; i++) {
                if (quotes.close[i] !== null) {
                    rowsToInsert.push({
                        ticker: symbol,
                        date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
                        open: Number(quotes.open[i]) || 0,
                        high: Number(quotes.high[i]) || 0,
                        low: Number(quotes.low[i]) || 0,
                        close: Number(quotes.close[i]) || 0,
                        volume: Math.round(Number(quotes.volume[i]) || 0)
                    });
                }
            }

            // 3. Upsert DB
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
                    // Map to plain objects for proper JSON serialization
                    return fallbackData.map(row => ({
                        date: row.date instanceof Date ? row.date.toISOString() : String(row.date),
                        open: Number(row.open),
                        high: Number(row.high),
                        low: Number(row.low),
                        close: Number(row.close),
                        volume: Number(row.volume)
                    }));
                }

                console.warn(`[MarketData] SAFETY NET FAILED: No local data found for ${symbol}`);
                return [];

            } catch (dbErr) {
                console.error(`[MarketData] CRITICAL: Fallback DB query failed for ${symbol}`, dbErr);
                return [];
            }
        }
    },

    // Check if fundamental data for these tickers is fresh (< 7 days)
    async checkFreshness(tickers: string[]): Promise<Set<string>> {
        if (tickers.length === 0) return new Set();
        try {
            // Keys are "fundamentals:TICKER"
            const keys = tickers.map(t => `fundamentals:${t.toUpperCase()}`);

            // We check updated_at or created_at. market_cache has 'created_at'.
            // TTL for fundamentals is 14 days, we want to skip if < 7 days old.
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const result = await sql`
                SELECT key FROM market_cache 
                WHERE key IN ${sql(keys)} 
                AND created_at > ${sevenDaysAgo}
            `;

            // Return set of tickers that ARE fresh (to be skipped)
            const freshTickers = new Set<string>();
            result.forEach(row => {
                const ticker = row.key.split(':')[1];
                if (ticker) freshTickers.add(ticker);
            });
            return freshTickers;

        } catch (e) {
            console.error('[MarketData] Freshness Check Error:', e);
            return new Set();
        }
    },

    // Sincronizar historial de TODAS las acciones conocidas (cartera + historial)
    // Parametro 'months' para definir cuanto tiempo atrás buscar (default 60 meses = 5 años)
    async syncPortfolioHistory(months: number = 60) {
        try {
            const tickers = await sql`
                SELECT DISTINCT ticker FROM (
                    SELECT ticker FROM positions
                    UNION
                    SELECT ticker FROM transactions
                ) as all_tickers
                WHERE ticker IS NOT NULL AND ticker != ''
            `;

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
        } catch (e) {
            console.error('Error syncing portfolio history:', e);
        }
    },

    // Sincronizar historial de divisas (Divisa -> EUR)
    async syncCurrencyHistory(months: number = 24) {
        try {
            // Obtener divisas únicas distintas de EUR
            const currencies = await sql`
                SELECT DISTINCT currency FROM (
                    SELECT currency FROM positions WHERE currency != 'EUR'
                    UNION
                    SELECT currency FROM transactions WHERE currency != 'EUR'
                ) as all_currencies
                WHERE currency IS NOT NULL AND currency != ''
            `;

            const period1 = Math.floor((Date.now() - (months * 30 * 86400 * 1000)) / 1000);
            const period2 = Math.floor(Date.now() / 1000);

            for (const c of currencies) {
                const currency = c.currency;
                const tickerYahoo = `${currency}EUR=X`; // Ejemplo: USDEUR=X
                const dbTicker = `${currency}/EUR`; // Formato solicitado para guardar en BD

                try {
                    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${tickerYahoo}?period1=${period1}&period2=${period2}&interval=1d`;
                    const response = await fetch(url);
                    if (!response.ok) continue;

                    const data = await response.json();
                    const result = data.chart?.result?.[0];
                    if (!result || !result.timestamp || !result.indicators?.quote?.[0]) continue;

                    const timestamps = result.timestamp;
                    const quotes = result.indicators.quote[0];

                    const rowsToInsert: any[] = [];
                    for (let i = 0; i < timestamps.length; i++) {
                        if (quotes.close[i]) {
                            rowsToInsert.push({
                                ticker: dbTicker,
                                date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
                                open: Number(quotes.open[i]) || 0,
                                high: Number(quotes.high[i]) || 0,
                                low: Number(quotes.low[i]) || 0,
                                close: Number(quotes.close[i]) || 0,
                                volume: Math.round(Number(quotes.volume[i]) || 0)
                            });
                        }
                    }

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
                } catch (err) {
                    console.error(`Error syncing currency ${dbTicker}:`, err);
                }
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        } catch (e) {
            console.error('Error syncing currency history:', e);
        }
    },

    /**
     * Get random tickers from global_tickers catalog for enrichment
     * Only returns tickers that haven't been processed or are stale (>7 days)
     * Excludes tickers marked as failed (yahoo_status = 'failed')
     */
    async getCatalogCandidates(limit: number): Promise<any[]> {
        try {
            const result = await sql`
                SELECT symbol, exchange, isin
                FROM global_tickers
                WHERE (last_processed_at IS NULL 
                   OR last_processed_at < NOW() - INTERVAL '7 days')
                  AND (yahoo_status IS NULL OR yahoo_status != 'failed')
                ORDER BY RANDOM()
                LIMIT ${limit}
            `;

            return result.map(r => ({
                ticker: r.exchange ? `${r.symbol}.${r.exchange}` : r.symbol,
                isin: r.isin || null,
                symbol: r.symbol,
                exchange: r.exchange
            }));
        } catch (e) {
            console.error('[MarketData] Error fetching catalog candidates:', e);
            return [];
        }
    },

    /**
     * Mark a ticker as processed in the catalog
     */
    async markCatalogProcessed(symbol: string, exchange: string): Promise<void> {
        try {
            await sql`
                UPDATE global_tickers 
                SET last_processed_at = NOW(), yahoo_status = 'ok'
                WHERE symbol = ${symbol} AND exchange = ${exchange}
            `;
        } catch (e) {
            console.error('[MarketData] Error marking ticker as processed:', e);
        }
    },

    /**
     * Mark a ticker as failed (Yahoo Finance doesn't support it)
     * These tickers will be skipped in future enrichment cycles
     */
    async markCatalogFailed(symbol: string, exchange: string, reason: string): Promise<void> {
        try {
            await sql`
                UPDATE global_tickers 
                SET last_processed_at = NOW(), 
                    yahoo_status = 'failed',
                    yahoo_error = ${reason.substring(0, 200)}
                WHERE symbol = ${symbol} AND exchange = ${exchange}
            `;
        } catch (e) {
            console.error('[MarketData] Error marking ticker as failed:', e);
        }
    },

    /**
     * Check if a ticker has fresh historical data in the database
     * @param ticker Ticker symbol
     * @returns true if historical data exists and is < 2 days old
     */
    async checkHistoricalFreshness(ticker: string): Promise<boolean> {
        try {
            const result = await sql`
                SELECT MAX(date) as last_date 
                FROM historical_data 
                WHERE ticker = ${ticker}
            `;

            const lastDate = result[0]?.last_date;
            if (!lastDate) return false;

            const daysSince = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000);
            return daysSince <= 2;
        } catch (e) {
            return false;
        }
    },

    /**
     * Get enhanced quote data with all metrics for Discovery Engine
     * @param ticker Ticker symbol
     * @param isin Optional ISIN for fallback search
     * @returns Enhanced discovery item with all calculated metrics
     */
    async getEnhancedQuoteData(ticker: string, isin?: string | null): Promise<any> {
        const {
            calculateRSI,
            calculateSMA,
            calculateVolatility,
            calculateSharpe,
            calculateAltmanZScore,
            getAltmanZone,
            getTrend,
            getValuationState,
            translateRecommendation
        } = await import('./calculations');

        try {
            const symbol = ticker.split('.')[0];
            let callsUsed = 0;
            let summary: any = null;
            let isCacheHit = false;
            console.error('[MarketData] getEnhancedQuoteData STARTED for', ticker);

            // 1. STRATEGY: 72H CACHE FIRST (As requested by User)
            // "The process should only read the data from the base, unless... older than 72 hours"
            try {
                const cached = await DiscoveryService.getTickerDetails(ticker);
                const CACHE_TTL_HOURS = 72;

                if (cached && cached.data) {
                    const diffHours = (Date.now() - new Date(cached.updated_at).getTime()) / (1000 * 60 * 60);
                    if (diffHours < CACHE_TTL_HOURS) {
                        // Check if we have the raw summary data required for hydration
                        if (cached.data.extended && cached.data.extended._raw) {
                            // console.log(`[MarketData] Cache HIT for ${ticker} (Age: ${diffHours.toFixed(1)}h). Using Cached Summary.`);
                            summary = cached.data.extended._raw;
                            isCacheHit = true;
                        }
                    } else {
                        // console.log(`[MarketData] Cache STALE for ${ticker} (Age: ${diffHours.toFixed(1)}h).`);
                    }
                }
            } catch (cacheErr) {
                console.warn(`[MarketData] Cache Check Error for ${ticker}`, cacheErr);
            }

            // 2. Fetch from Yahoo if not in Cache
            if (!summary) {
                try {
                    // Requesting ALL 10 optimized modules for complete data
                    summary = await yahooFinance.quoteSummary(ticker, {
                        modules: [
                            'assetProfile',           // Governance risk scores, company officers, sector
                            'summaryDetail',          // Dividend rate/yield, ex-dividend date, 52-week range
                            'price',                  // Current price, volume, market cap
                            'defaultKeyStatistics',   // Beta, EPS, shares, book value
                            'financialData',          // Target prices, recommendations, financial health
                            'calendarEvents',         // Earnings date, dividend date
                            'recommendationTrend',    // Analyst breakdown (strongBuy/buy/hold/sell)
                            'earnings',               // EPS actual/estimate
                            'earningsHistory',        // Historical EPS surprises
                            'earningsTrend',          // Forward projections
                        ]
                    });
                    callsUsed++;
                } catch (e: any) {
                    // FALLBACK STRATEGY: Try searching by ISIN if available
                    if (isin && (e.message?.includes('Not Found') || e.message?.includes('Quote not found'))) {
                        try {
                            const searchResult = await yahooFinance.search(isin);
                            if (searchResult.quotes && searchResult.quotes.length > 0) {
                                const firstQuote: any = searchResult.quotes[0];
                                const foundTicker = firstQuote.symbol as string;

                                summary = await yahooFinance.quoteSummary(foundTicker, {
                                    modules: [
                                        'assetProfile', 'summaryDetail', 'price', 'defaultKeyStatistics',
                                        'financialData', 'calendarEvents', 'recommendationTrend',
                                        'earnings', 'earningsHistory', 'earningsTrend'
                                    ]
                                });
                                callsUsed += 2; // Search + Retry
                                ticker = foundTicker; // Update ticker for subsequent logic
                            } else {
                                throw e;
                            }
                        } catch (searchError) {
                            throw e; // Original error if search fails
                        }
                    } else {
                        throw e;
                    }
                }
            }

            const price = summary?.price;
            const profile = summary?.summaryProfile || summary?.assetProfile; // Support both
            const assetProfile = summary?.assetProfile;
            const summaryDetail = summary?.summaryDetail;
            const stats = summary?.defaultKeyStatistics;
            const financial = summary?.financialData;
            const recommendations = summary?.recommendationTrend;
            const calendarEvents = summary?.calendarEvents;
            const earningsHistory = summary?.earningsHistory;
            const earningsTrend = summary?.earningsTrend;

            if (!price || price.regularMarketPrice === undefined) {
                console.error('[MarketData] Returning NULL because price or regularMarketPrice is missing', { price });
                return null;
            }

            const currentPrice = price.regularMarketPrice;
            const name = price.longName || price.shortName || symbol;
            const sector = profile?.sector || 'Unknown';

            // 2. Get historical data (check BD first, then Yahoo)
            let historicalPrices: number[] = [];
            const hasRecentHistorical = await this.checkHistoricalFreshness(ticker);

            if (hasRecentHistorical) {
                // Use data from database (Fetch OHLC)
                const dbData = await sql`
                    SELECT date, open, high, low, close FROM historical_data
                    WHERE ticker = ${ticker}
                    ORDER BY date DESC
                    LIMIT 50
                `;
                historicalPrices = dbData.map((r: any) => parseFloat(r.close)).reverse();

                // Prepare Candles
                (summary as any).candles = dbData.map((r: any) => ({
                    time: new Date(r.date).toISOString().split('T')[0],
                    open: parseFloat(r.open || r.close),
                    high: parseFloat(r.high || r.close),
                    low: parseFloat(r.low || r.close),
                    close: parseFloat(r.close)
                })).reverse();

            } else {
                // Fetch from Yahoo
                const period1 = Math.floor((Date.now() - (50 * 86400 * 1000)) / 1000);
                const period2 = Math.floor(Date.now() / 1000);
                const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${period1}&period2=${period2}&interval=1d`;

                const response = await fetch(url);
                if (response.ok) {
                    callsUsed++;
                    const data = await response.json();
                    const result = data.chart?.result?.[0];

                    if (result?.timestamp && result?.indicators?.quote?.[0]?.close) {
                        const quotes = result.indicators.quote[0];
                        const closes = quotes.close; // Restore 'closes' for legacy loop below
                        const timestamps = result.timestamp;
                        historicalPrices = closes.filter((c: any) => c !== null);


                        // NEW: Prepare Candle Data from API Response
                        const apiCandles: any[] = [];

                        for (let i = 0; i < timestamps.length; i++) {
                            // Check if we have valid OHLC data for this point
                            if (timestamps[i] && quotes.open[i] != null && quotes.high[i] != null && quotes.low[i] != null && quotes.close[i] != null) {
                                apiCandles.push({
                                    time: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
                                    open: parseFloat(quotes.open[i]),
                                    high: parseFloat(quotes.high[i]),
                                    low: parseFloat(quotes.low[i]),
                                    close: parseFloat(quotes.close[i])
                                });
                            }
                        }
                        // Attach to summary
                        (summary as any).candles = apiCandles;

                        // Store in database for future use

                        for (let i = 0; i < timestamps.length; i++) {
                            if (closes[i]) {
                                const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
                                await sql`
                                    INSERT INTO historical_data (ticker, date, open, high, low, close, volume)
                                    VALUES (${ticker}, ${date}::date, ${closes[i]}, ${closes[i]}, ${closes[i]}, ${closes[i]}, 0)
                                    ON CONFLICT (ticker, date) DO NOTHING
                                `;
                            }
                        }
                    }
                }
            }

            // 3. Calculate technical metrics
            const rsi7 = calculateRSI(historicalPrices, 7);
            const rsi14 = calculateRSI(historicalPrices, 14);
            const sma50 = calculateSMA(historicalPrices, 50);
            const volatility = calculateVolatility(historicalPrices);
            const sharpe = calculateSharpe(historicalPrices);
            const trend = getTrend(currentPrice, sma50);

            const sma50Diff = sma50 !== "N/A"
                ? Math.round(((currentPrice - (sma50 as number)) / (sma50 as number)) * 10000) / 100
                : "N/A";

            // 4. Calculate Altman Z-Score
            const zScore = calculateAltmanZScore(financial);
            const zZone = getAltmanZone(zScore);

            // 5. Valuation
            const earningsPerShare = financial?.earningsPerShare || 0;
            const currentPriceCalc = financial?.currentPrice !== undefined ? financial.currentPrice : currentPrice;
            const peRatio = stats?.forwardPE || (earningsPerShare !== 0 ? currentPriceCalc / earningsPerShare : null);
            const valuationState = getValuationState(peRatio);

            // 6. Analysts
            const recommendation = translateRecommendation(recommendations?.trend?.[0]?.period);
            const numAnalysts = stats?.numberOfAnalystOpinions || 0;
            const targetMean = financial?.targetMeanPrice || null;

            // 7. Price history (last 30 days)
            const priceHistory = historicalPrices.slice(-30);

            // 8. EXTENDED DATA MAPPING (Flatten diverse modules)
            const extended: Record<string, any> = {};

            // Helper to recursively flatten objects
            const flatten = (obj: any, prefix = '') => {
                if (!obj || typeof obj !== 'object') return;
                Object.keys(obj).forEach(key => {
                    const value = obj[key];
                    const newKey = prefix ? `${prefix}_${key}` : key;
                    if (value && typeof value === 'object' && 'raw' in value) {
                        // Yahoo "fmt"/"raw" objects -> take raw
                        extended[newKey] = value.raw;
                    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                        // Recurse (skip nested dates to avoid clutter)
                        if (key !== 'maxAge' && key !== 'endDate') flatten(value, newKey);
                    } else if (value !== null && value !== undefined && typeof value !== 'function') {
                        // Primitive
                        extended[newKey] = value;
                    }
                });
            };

            // Map specific interesting modules
            if (summary?.financialData) flatten(summary.financialData, 'fin');
            if (summary?.defaultKeyStatistics) flatten(summary.defaultKeyStatistics, 'stat');

            // Add latest statements if available
            const income = summary?.incomeStatementHistory?.incomeStatementHistory?.[0];
            if (income) flatten(income, 'inc');

            const balance = summary?.balanceSheetHistory?.balanceSheetStatements?.[0];
            if (balance) flatten(balance, 'bal');

            const cashflow = summary?.cashflowStatementHistory?.cashflowStatements?.[0];
            if (cashflow) flatten(cashflow, 'cf');

            // KEY: Save the RAW summary in extended so it can be cached and re-used for hydration
            extended['_raw'] = summary;

            const result = {
                t: ticker,
                n: name,
                s: sector,
                industry: profile?.industry || assetProfile?.industry || 'Unknown',
                p: currentPrice,
                chg_1d: ((price.regularMarketChangePercent || 0) * 100),
                source: isCacheHit ? 'Cache (72h)' : 'Yahoo V10 Complete',
                callsUsed,

                valuation: {
                    state: valuationState,
                    peRatio: peRatio || null,
                    peForward: stats?.forwardPE || null,
                    pegRatio: stats?.pegRatio || null,
                    priceToBook: stats?.priceToBook || null,
                    evRevenue: stats?.enterpriseToRevenue || null,
                    evEbitda: stats?.enterpriseToEbitda || null,
                    targetPrice: targetMean,
                    targetHigh: financial?.targetHighPrice || null,
                    targetLow: financial?.targetLowPrice || null,
                    marketCap: price?.marketCap || null,
                    enterpriseValue: stats?.enterpriseValue || null,
                },

                // NEW: Governance Risk Scores (from assetProfile)
                governance: assetProfile ? {
                    auditRisk: assetProfile.auditRisk || null,
                    boardRisk: assetProfile.boardRisk || null,
                    compensationRisk: assetProfile.compensationRisk || null,
                    shareholderRightsRisk: assetProfile.shareHolderRightsRisk || null,
                    overallRisk: assetProfile.overallRisk || null,
                } : null,

                // NEW: Dividend Data (from summaryDetail)
                dividends: {
                    rate: summaryDetail?.dividendRate || 0,
                    yield: summaryDetail?.dividendYield || 0,
                    exDate: summaryDetail?.exDividendDate || null,
                    payoutRatio: summaryDetail?.payoutRatio || 0,
                    trailingAnnualRate: summaryDetail?.trailingAnnualDividendRate || 0,
                    trailingAnnualYield: summaryDetail?.trailingAnnualDividendYield || 0,
                },

                // NEW: Calendar Events (from calendarEvents)
                calendar: {
                    earningsDate: calendarEvents?.earnings?.earningsDate?.[0] || null,
                    epsEstimate: calendarEvents?.earnings?.earningsAverage || null,
                    epsLow: calendarEvents?.earnings?.earningsLow || null,
                    epsHigh: calendarEvents?.earnings?.earningsHigh || null,
                    revenueEstimate: calendarEvents?.earnings?.revenueAverage || null,
                    revenueLow: calendarEvents?.earnings?.revenueLow || null,
                    revenueHigh: calendarEvents?.earnings?.revenueHigh || null,
                    dividendDate: calendarEvents?.dividendDate || null,
                    exDividendDate: calendarEvents?.exDividendDate || null,
                },

                risk: {
                    altmanZScore: zScore,
                    zone: zZone,
                    beta: stats?.beta || null,
                    // 52-week range from summaryDetail
                    fiftyTwoWeekHigh: summaryDetail?.fiftyTwoWeekHigh || null,
                    fiftyTwoWeekLow: summaryDetail?.fiftyTwoWeekLow || null,
                    // Short interest
                    shortRatio: stats?.shortRatio || null,
                    shortPercentFloat: stats?.shortPercentOfFloat || null,
                },

                technical: {
                    rsi14: rsi14,
                    sma50Diff: sma50Diff,
                    volatility: volatility,
                    sharpe: sharpe
                },

                // ENHANCED: Analyst Data with breakdown and trend
                analysts: {
                    recommendation: recommendation,
                    recommendationKey: financial?.recommendationKey || null,
                    recommendationMean: financial?.recommendationMean || null,
                    numberOfAnalysts: financial?.numberOfAnalystOpinions || numAnalysts,
                    targetMean: financial?.targetMeanPrice || targetMean,
                    targetMedian: financial?.targetMedianPrice || null,
                    targetHigh: financial?.targetHighPrice || null,
                    targetLow: financial?.targetLowPrice || null,
                    // Breakdown from recommendationTrend
                    breakdown: recommendations?.trend?.[0] ? {
                        strongBuy: recommendations.trend[0].strongBuy || 0,
                        buy: recommendations.trend[0].buy || 0,
                        hold: recommendations.trend[0].hold || 0,
                        sell: recommendations.trend[0].sell || 0,
                        strongSell: recommendations.trend[0].strongSell || 0,
                    } : null,
                    // Trend history (last 4 months)
                    trendHistory: recommendations?.trend?.map((t: any) => ({
                        period: t.period,
                        strongBuy: t.strongBuy,
                        buy: t.buy,
                        hold: t.hold,
                        sell: t.sell,
                        strongSell: t.strongSell,
                    })) || [],
                },

                // NEW: EPS History & Projections
                earnings: {
                    trailing: stats?.trailingEps || null,
                    forward: stats?.forwardEps || null,
                    quarterlyGrowth: stats?.earningsQuarterlyGrowth || null,
                    // History from earningsHistory (last 4 quarters)
                    history: earningsHistory?.history?.map((e: any) => ({
                        quarter: e.quarter,
                        actual: e.epsActual,
                        estimate: e.epsEstimate,
                        surprise: e.epsDifference,
                        surprisePct: e.surprisePercent,
                    })) || [],
                    // Projections from earningsTrend
                    projections: earningsTrend?.trend?.map((t: any) => ({
                        period: t.period,
                        endDate: t.endDate,
                        growth: t.growth,
                        epsAvg: t.earningsEstimate?.avg || null,
                        epsLow: t.earningsEstimate?.low || null,
                        epsHigh: t.earningsEstimate?.high || null,
                        revenueAvg: t.revenueEstimate?.avg || null,
                    })) || [],
                },

                // Financial Health
                financialHealth: {
                    totalCash: financial?.totalCash || null,
                    totalDebt: financial?.totalDebt || null,
                    debtToEquity: financial?.debtToEquity || null,
                    currentRatio: financial?.currentRatio || null,
                    quickRatio: financial?.quickRatio || null,
                    freeCashflow: financial?.freeCashflow || null,
                    operatingCashflow: financial?.operatingCashflow || null,
                    grossMargins: financial?.grossMargins || null,
                    operatingMargins: financial?.operatingMargins || null,
                    profitMargins: financial?.profitMargins || null,
                    revenueGrowth: financial?.revenueGrowth || null,
                    earningsGrowth: financial?.earningsGrowth || null,
                    returnOnEquity: financial?.returnOnEquity || null,
                    returnOnAssets: financial?.returnOnAssets || null,
                },

                priceHistory: priceHistory,
                candles: (summary as any).candles || [], // Include candles for advanced charts
                extended: extended // SEND EVERYTHING
            };

            // 9. SAVE TO CACHE (If not a hit, and we have valid data)
            if (!isCacheHit) {
                // Determine category? Use 'manual' or existing logic
                await DiscoveryService.saveTickerDetails(ticker, result);
                // console.log(`[MarketData] Saved FRESH data for ${ticker} to ticker_details_cache`);
            }

            return result;

        } catch (e: any) {
            console.error(`[MarketData] Error getting enhanced data for ${ticker}:`, e);
            return null;
        }
    },
};
