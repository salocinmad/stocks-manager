import sql from '../db';
import { NewsService } from './newsService';
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();
import { DiscoveryItem } from './discoveryService';

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
}

export interface CompanyEvent {
    id: string;
    date: string;               // ISO Date String
    type: 'EARNINGS_RELEASE' | 'EARNINGS_CALL' | 'DIVIDEND' | 'SPLIT' | 'OTHER';
    title: string;
    description: string;
    isConfirmed: boolean;
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
                modules: ['calendarEvents', 'earnings']
            });

            if (!summary) return [];

            const events: CompanyEvent[] = [];
            const ce = summary.calendarEvents;
            const earn = summary.earnings;

            if (ce) {
                // 1. Next Earnings Date (Confirmed)
                if (ce.earnings && ce.earnings.earningsDate && ce.earnings.earningsDate.length > 0) {
                    const date = ce.earnings.earningsDate[0];
                    events.push({
                        id: `earn-${date.getTime()}`,
                        date: date.toISOString(),
                        type: 'EARNINGS_RELEASE',
                        title: 'Resultados (Próximos)',
                        description: `Publicación oficial de resultados. Estimación: ${ce.earnings.earningsAverage || 'N/A'}`,
                        isConfirmed: true
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
                    events.push({
                        id: `div-ex-${ce.exDividendDate.getTime()}`,
                        date: ce.exDividendDate.toISOString(),
                        type: 'DIVIDEND',
                        title: 'Ex-Dividendo',
                        description: `Fecha límite para tener acciones y cobrar.`,
                        isConfirmed: true
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
    async getDiscoveryCandidates(scrId: string, count: number = 25): Promise<DiscoveryItem[]> {
        try {
            console.log(`[MarketData] Obteniendo Candidatos de Descubrimiento para ${scrId}...`);
            const result = await yahooFinance.screener({ scrIds: scrId as any, count: count }, undefined, { validateResult: false }) as any;

            if (!result || !result.quotes) return [];

            // DEBUG: Print keys of first item to find sector field
            if (result.quotes.length > 0) { console.log('KEYS:', Object.keys(result.quotes[0])); }

            return result.quotes.map((q: any) => ({
                t: q.symbol,
                n: q.shortName || q.longName || q.symbol,
                s: q.sector || 'Unknown',
                p: q.regularMarketPrice || 0,
                chg_1d: q.regularMarketChangePercent || 0,
                chg_1w: q.fiftyTwoWeekChangePercent ? q.fiftyTwoWeekChangePercent / 52 : undefined,
                vol_rel: q.averageDailyVolume3Month ? (q.regularMarketVolume / q.averageDailyVolume3Month) : 1,
                tech: {
                    rsi: 50, // Calculated later
                    trend: (q.regularMarketChangePercent || 0) > 0 ? 'Bullish' : 'Bearish',
                    sma50_diff: (q.fiftyDayAverageChangePercent || 0) * 100
                },
                fund: {
                    mcap: q.marketCap ? (q.marketCap / 1e9).toFixed(2) + 'B' : 'N/A',
                    recs: 'Hold',
                    target: 0
                }
            }));

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

    async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number | null> {
        if (fromCurrency === toCurrency) return 1.0;

        const cacheKey = "rate:" + fromCurrency + ":" + toCurrency;
        const cached = await getFromCache<number>(cacheKey);
        if (cached !== null) {
            return cached;
        }

        try {
            const symbol = fromCurrency + toCurrency + "=X";
            // Reuse getQuote logic since it fetches the same chart data
            const quote = await this.getQuote(symbol);

            if (quote && quote.c) {
                await setCache(cacheKey, quote.c, TTL.EXCHANGE_RATE);
                return quote.c;
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

            const result: QuoteResult = {
                c: meta.regularMarketPrice || 0,
                pc: meta.chartPreviousClose || meta.previousClose || 0,
                d: (meta.regularMarketPrice || 0) - (meta.chartPreviousClose || 0),
                dp: 0, // calculate percentage manually
                currency: meta.currency || 'USD',
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
        const cached = await getFromCache<FundamentalData>(cacheKey);
        if (cached !== null) {
            return cached;
        }

        try {
            // Usamos la librería oficial para datos fundamentales complejos
            const summary = await yahooFinance.quoteSummary(ticker, {
                modules: ['financialData', 'defaultKeyStatistics', 'summaryDetail', 'calendarEvents', 'price']
            });

            if (!summary) return null;

            const fd = summary.financialData;
            const ks = summary.defaultKeyStatistics; // Key Stats (EV, Shares)
            const sd = summary.summaryDetail;       // Market Cap, Dividend Yield, Trailing PE
            const ce = summary.calendarEvents;      // Earnings
            // const price = summary.price;            // Name, Currency (Optional redundancy)

            if (!fd || !sd) return null;

            // Helper para extraer raw values de forma segura
            const val = (obj: any) => (obj && typeof obj === 'object' && 'raw' in obj) ? (obj.raw || 0) : (obj || 0);
            const fmt = (obj: any) => (obj && typeof obj === 'object' && 'fmt' in obj) ? obj.fmt : null;

            const data: FundamentalData = {
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
                shortRatio: val(ks?.shortRatio) // NEW
            };

            await setCache(cacheKey, data, TTL.FUNDAMENTALS);
            return data;

        } catch (e) {
            console.error(`[MarketData] Fundamentals Error for ${ticker}: `, e);
            // No devolvemos null para no romper todo el analisis, tal vez un objeto vacio o partial?
            // Mejor null y que el frontend maneje "N/A"
            return null;
        }
    },

    // Obtener perfil del activo (sector/industria) - Finnhub primario, Yahoo fallback
    async getAssetProfile(ticker: string) {
        const cacheKey = `profile:${ticker.toUpperCase()}`;
        const cached = await getFromCache<any>(cacheKey);
        if (cached !== null) {
            return cached;
        }

        const finnhubKey = process.env.FINNHUB_API_KEY;

        // Try Finnhub first (more reliable)
        if (finnhubKey) {
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
                            longBusinessSummary: null,
                            fullTimeEmployees: data.employeeTotal || null,
                            name: data.name || ticker,
                            logo: data.logo || null
                        };

                        await setCache(cacheKey, profile, TTL.PROFILE);
                        return profile;
                    }
                }
            } catch (e) {
                console.warn(`[Finnhub Profile] Error for ${ticker}:`, e);
            }
        }

        // Fallback to Yahoo V10 quoteSummary
        try {
            const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=summaryProfile,price`;
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                    "Accept": "application/json;q=0.9,*/*;q=0.8"
                }
            });
            if (!response.ok) throw new Error('Fetch failed ' + response.status);

            const data = await response.json();
            const result = data.quoteSummary?.result?.[0];

            const profile = {
                sector: result?.summaryProfile?.sector || 'Desconocido',
                industry: result?.summaryProfile?.industry || 'Desconocido',
                country: result?.summaryProfile?.country || 'Desconocido',
                website: result?.summaryProfile?.website || null,
                longBusinessSummary: result?.summaryProfile?.longBusinessSummary || null,
                fullTimeEmployees: result?.summaryProfile?.fullTimeEmployees || null,
                name: result?.price?.longName || result?.price?.shortName || ticker,
                logo: null
            };

            await setCache(cacheKey, profile, TTL.PROFILE);
            return profile;
        } catch (e) {
            console.error(`Asset Profile Error for ${ticker}:`, e);

            // EMERGENCY FALLBACK: Manual mapping for common stocks (IBEX/Continuous/US)
            const manualMap: Record<string, string> = {
                // IBEX 35 / Spanish
                'DIA.MC': 'Consumer Defensive', 'OHLA.MC': 'Industrials', 'AMP.MC': 'Industrials',
                'ITX.MC': 'Consumer Cyclical', 'SAN.MC': 'Financial Services', 'BBVA.MC': 'Financial Services',
                'TEF.MC': 'Communication Services', 'IBE.MC': 'Utilities', 'REP.MC': 'Energy',
                'ACS.MC': 'Industrials', 'FER.MC': 'Industrials', 'AENA.MC': 'Industrials',
                'AMS.MC': 'Technology', 'MRL.MC': 'Real Estate', 'CLNX.MC': 'Communication Services',
                'GRF.MC': 'Healthcare', 'IAG.MC': 'Industrials', 'ANA.MC': 'Industrials',
                'ENG.MC': 'Utilities', 'ELE.MC': 'Utilities', 'NTGY.MC': 'Utilities',
                'REE.MC': 'Utilities', 'MAP.MC': 'Financial Services', 'BKT.MC': 'Financial Services',
                'SAB.MC': 'Financial Services', 'CABK.MC': 'Financial Services',
                'MEL.MC': 'Consumer Cyclical', 'ACX.MC': 'Basic Materials', 'MTS.MC': 'Basic Materials',
                'VIG.MC': 'Real Estate',

                // US / Global
                'AAPL': 'Technology', 'MSFT': 'Technology', 'GOOGL': 'Technology', 'AMZN': 'Consumer Cyclical',
                'NVDA': 'Technology', 'TSLA': 'Consumer Cyclical', 'META': 'Communication Services',
                'BRK.B': 'Financial Services', 'JPM': 'Financial Services', 'V': 'Financial Services',
                'JNJ': 'Healthcare', 'PG': 'Consumer Defensive', 'XOM': 'Energy', 'CVX': 'Energy'
            };

            const knownSector = manualMap[ticker.toUpperCase()];
            if (knownSector) {
                return {
                    sector: knownSector,
                    industry: 'Manual Fallback',
                    country: ticker.includes('.MC') ? 'ES' : 'US'
                };
            }

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
    async getMarketStatus(indices: string[]) {
        try {
            console.log(`[MarketStatus] Fetching status for ${indices.length} indices via Yahoo V10...`);

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

            return results;

        } catch (e) {
            console.error('[MarketStatus] Global error:', e);
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
    async getAnalystRecommendations(ticker: string) {
        const apiKey = process.env.FINNHUB_API_KEY;
        if (!apiKey) return null;
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

    async getInsiderSentiment(ticker: string) {
        const apiKey = process.env.FINNHUB_API_KEY;
        if (!apiKey) return null;
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
    }
};
