import sql from '../db';
import { MarketDataService } from './marketData'; // Keep imports
import { SettingsService } from './settingsService';
import { NotificationService } from './notificationService';
import { AIProviderFactory } from './ai/AIProviderFactory';
import { DiscoveryService } from './discoveryService';

// Cache for the active provider instance usually managed within Factory or just re-fetched lightly
// For now, we fetch fresh to ensure config updates apply immediately.

const getProvider = async () => {
    try {
        return await AIProviderFactory.getActiveProvider();
    } catch (e: any) {
        console.error("Error getting AI Provider:", e);
        return null; // Handle gracefully
    }
};

export const AIService = {
    async _buildPortfolioAnalysisPrompt(userId: string, userMessage: string, portfolioId?: string) {
        // 1. Fetch Context
        let query = sql`
            SELECT p.name, pos.ticker, pos.quantity, pos.average_buy_price, pos.asset_type 
            FROM portfolios p
            JOIN positions pos ON p.id = pos.portfolio_id
            WHERE p.user_id = ${userId}
        `;

        // Filter by specific portfolio if provided
        if (portfolioId) {
            query = sql`
                SELECT p.name, pos.ticker, pos.quantity, pos.average_buy_price, pos.asset_type 
                FROM portfolios p
                JOIN positions pos ON p.id = pos.portfolio_id
                WHERE p.user_id = ${userId} AND p.id = ${portfolioId}
            `;
        }

        const portfolios = await query;

        const portfolioSummary = portfolios.map(p =>
            `- ${p.ticker} (${p.asset_type}): ${p.quantity} unidades @ ${p.average_buy_price}`
        ).join('\n');

        // 2. Enrich with Historical Data
        const potentialTickersInMessage = (userMessage.match(/\b[A-Z]{2,6}\b/g) || [])
            .filter(t => !['HOLA', 'PARA', 'COMO', 'ESTA', 'TODO', 'BIEN', 'PERO', 'DONDE', 'CUANDO'].includes(t));

        const portfolioTickers = portfolios.map(p => p.ticker);
        const relevantTickers = Array.from(new Set([...potentialTickersInMessage, ...portfolioTickers]));

        let marketContext = "";
        let newsDataStr = ""; // Block for {{NEWS_CONTEXT}}

        // Procesar máximo 20 tickers para no exceder contexto (pero cubrir portafolio típico)
        if (relevantTickers.length > 0) {
            marketContext += "\n--- DATOS DE MERCADO EN TIEMPO REAL E HISTÓRICOS ---\n";

            for (const ticker of relevantTickers.slice(0, 20)) {
                try {
                    // Obtener 2 años de historia para análisis profundo
                    const sanitizedTicker = ticker.trim().toUpperCase();

                    // Parallelize data fetching (Full Pack)
                    const [history, quote, news, analysts, peers, insider] = await Promise.all([
                        MarketDataService.getDetailedHistory(sanitizedTicker, 2),
                        MarketDataService.getQuote(sanitizedTicker),
                        MarketDataService.getCompanyNews(sanitizedTicker),
                        MarketDataService.getAnalystRecommendations(sanitizedTicker),
                        MarketDataService.getPeers(sanitizedTicker),
                        MarketDataService.getInsiderSentiment(sanitizedTicker)
                    ]);

                    if (quote) {
                        const currencySymbol = quote?.currency === 'EUR' ? '€' : quote?.currency === 'GBP' ? '£' : '$';
                        const quoteTime = new Date(quote.lastUpdated || Date.now()).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

                        marketContext += `\nTicker: ${ticker} (${quote.name})\n`;
                        marketContext += `PRECIO: ${currencySymbol}${quote.c.toFixed(2)} (${quote.dp >= 0 ? '+' : ''}${quote.dp.toFixed(2)}%)\n`;

                        // FUNDAMENTALES
                        marketContext += `- Market Cap: ${quote.marketCap || 'N/A'} | Beta: ${quote.beta || 'N/A'} | PER: ${quote.peRatio || 'N/A'}\n`;
                        marketContext += `- Prox. Resultados: ${quote.earningsDate || 'N/A'}\n`;
                        if (quote.targetMeanPrice) {
                            marketContext += `- Precio Objetivo: ${currencySymbol}${quote.targetMeanPrice} (${quote.recommendationKey || 'N/A'})\n`;
                        }

                        // TÉCNICO
                        if (history && history.length > 15) {
                            const prices = history.map(h => Number(h.close));
                            const tech = MarketDataService.getTechnicalIndicators(prices);
                            if (tech) {
                                marketContext += `- RSI(14): ${tech.rsi} | SMA50: ${tech.sma50} | SMA200: ${tech.sma200} | Tendencia: ${tech.trend}\n`;
                            }

                            // Calculated YoY
                            const last = history[history.length - 1];
                            const oneYearAgo = history.find(h => new Date(h.date) <= new Date(Date.now() - 365 * 24 * 3600 * 1000)) || history[0];
                            const change1Y = ((last.close - oneYearAgo.close) / oneYearAgo.close * 100).toFixed(2);
                            marketContext += `- Rendimiento 1 Año: ${change1Y}%\n`;
                        }

                        // INSIGHTS
                        if (peers && peers.length > 0) marketContext += `- Competencia: ${peers.slice(0, 3).join(', ')}\n`;
                        if (insider) marketContext += `- Insider (3m): ${insider.label}\n`;

                        // Add News to NEWS BLOCK
                        if (news && news.length > 0) {
                            newsDataStr += `\n📰 NOTICIAS (${ticker}):\n`;
                            news.slice(0, 4).forEach((n: any) => {
                                newsDataStr += `- ${n.title}\n`;
                            });
                        }

                    } else {
                        console.warn(`[AIService] No quote found for ${ticker}`);
                    }
                } catch (err) {
                    console.error(`Error fetching AI context for ${ticker}`, err);
                }
            }
        }


        if (!newsDataStr) {
            newsDataStr = "No hay noticias recientes relevantes.";
        }

        // 3. Construct Prompt using Template from DB (Active Prompt)
        let promptTemplate = "";
        try {
            const [activePrompt] = await sql`
                SELECT content FROM ai_prompts 
                WHERE prompt_type = 'ANALYSIS' AND is_active = true 
                LIMIT 1
            `;
            if (activePrompt) {
                promptTemplate = activePrompt.content;
            }
        } catch (e) {
            console.error('Error fetching active analysis prompt:', e);
        }

        if (!promptTemplate) {
            promptTemplate = `Actúa como "Stocks Bot", un Analista Financiero Senior experto de Wall Street creado para esta plataforma.

CONTEXTO DEL PORTAFOLIO DEL CLIENTE:
{{PORTFOLIO_CONTEXT}}

DATOS DE MERCADO:
{{MARKET_CONTEXT}}

NOTICIAS RELACIONADAS:
{{NEWS_CONTEXT}}

Pregunta del usuario: "{{USER_MESSAGE}}"

INSTRUCCIONES:
- Responde en español, de forma profesional, concisa y basada en los DATOS proporcionados arriba.
- Si ves una sección "📰 NOTICIAS", **DEBES resumir o listar los titulares más relevantes** al usuario.
- Si ves una "Curva de Precios", analízala brevemente (tendencia alcista/bajista, volatilidad).
- Da consejos estratégicos sobre diversificación y riesgo si aplica.
- Identifícate siempre como Stocks Bot.`;
        }

        // Discovery Engine Data (Global Context)
        try {
            const discoveryStats = await DiscoveryService.getAllDiscoveryData();
            if (discoveryStats && Object.keys(discoveryStats).length > 0) {
                marketContext += "\n📡 RADAR DE MERCADO (Discovery Engine):\n";

                // Trending
                const trendingKey = discoveryStats['trending_global'] ? 'trending_global' : (discoveryStats['day_gainers'] ? 'day_gainers' : null);
                if (trendingKey) {
                    const trends = discoveryStats[trendingKey].slice(0, 5).map((i: any) => {
                        const isOwned = portfolioTickers.includes(i.t);
                        return `${i.t} (${i.chg_1d > 0 ? '+' : ''}${i.chg_1d.toFixed(1)}%${isOwned ? ' ✅' : ''})`;
                    }).join(', ');
                    marketContext += `🔥 Tendencia Global: ${trends}\n`;
                }

                // Sectors
                const sectors = Object.keys(discoveryStats).filter(k => k.startsWith('sector_')).map(k => k.replace('sector_', '')).join(', ');
                if (sectors) marketContext += `🏗️ Sectores Rastreados: ${sectors}\n`;
            }
        } catch (e) {
            console.error('Data Discovery Error (Portfolio):', e);
        }

        // Debug Context (Temporary)
        // console.log('[AI PROMPT CONTEXT]', marketContext);

        const prompt = promptTemplate
            .replace('{{PORTFOLIO_CONTEXT}}', portfolioSummary || "Portafolio vacío por el momento.")
            .replace('{{MARKET_CONTEXT}}', marketContext)
            .replace('{{MARKET_DATA}}', marketContext) // Support user's custom placeholder
            .replace('{{NEWS_CONTEXT}}', newsDataStr)
            .replace('{{USER_MESSAGE}}', userMessage);

        return prompt;
    },

    async analyzePortfolio(userId: string, userMessage: string) {
        const provider = await getProvider();
        if (!provider) return "Error: Servicio IA no configurado (Proveedor no encontrado).";
        // removed validate call, provider factory handles base config, but we could add provider.validateConfig()

        const prompt = await this._buildPortfolioAnalysisPrompt(userId, userMessage);

        try {
            const result = await provider.generateContent(prompt);
            return result;
        } catch (e: any) {
            console.error("AI Error:", e);
            const errorMessage = e.message || JSON.stringify(e);

            if (errorMessage.includes('API key') || errorMessage.includes('expired') || errorMessage.includes('401')) {
                console.error('🚨 [ADMIN ALERT] AI PROVIDER API KEY EXPIRED OR INVALID (Portfolio).');
                NotificationService.notifyAdmin('AI API KEY ERROR', 'La API Key del proveedor de IA ha fallado. El análisis de portafolio ha fallado.');
                return "⚠️ **Error Crítico**: La API Key de IA ha fallado. Por favor avisa al administrador del sistema.";
            }

            // Handle Quota/Rate Limit Errors
            if (errorMessage.includes('429') || errorMessage.includes('Quota') || errorMessage.includes('exhausted')) {
                console.error('🚨 [ADMIN ALERT] AI QUOTA EXCEEDED.');
                NotificationService.notifyAdmin('AI QUOTA EXCEEDED', 'El modelo de IA seleccionado ha superado el límite de cuota.');
                return "⚠️ **Límite de Cuota Excedido** ⚠️\n\nEl proveedor de IA ha superado su límite de uso.\n\n👉 **Solución**: Contacta al administrador.";
            }

            return `Error: ${e.message}`;
        }
    },

    async analyzePortfolioStream(userId: string, userMessage: string, portfolioId?: string) {
        const provider = await getProvider();
        if (!provider) {
            return async function* () { yield "Error: Servicio IA no configurado." }();
        }

        const prompt = await this._buildPortfolioAnalysisPrompt(userId, userMessage, portfolioId);

        try {
            const stream = await provider.generateStream(prompt);
            return stream;
        } catch (e: any) {
            console.error("AI Stream Error:", e);
            const errorMessage = e.message || JSON.stringify(e);

            if (errorMessage.includes('API key') || errorMessage.includes('expired') || errorMessage.includes('401')) {
                console.error('🚨 [ADMIN ALERT] AI PROVIDER API KEY INVALID (Portfolio Stream).');
                return async function* () {
                    yield "⚠️ **Error Crítico**: Problema con la API Key del proveedor de IA.";
                }();
            }

            if (errorMessage.includes('429') || errorMessage.includes('Quota') || errorMessage.includes('exhausted')) {
                console.error('🚨 [ADMIN ALERT] AI QUOTA EXCEEDED (Stream).');
                return async function* () {
                    yield "⚠️ **Límite de Cuota Excedido**: El proveedor está saturado.";
                }();
            }

            return async function* () { yield `Error: ${e.message}`; }();
        }
    },

    async _buildChatPrompt(userId: string, messages: { role: string, text: string }[]) {
        // Obtener el último mensaje del usuario
        const lastUserMessage = messages[messages.length - 1]?.text || "";

        // 1. Obtener contexto completo del usuario
        let userContext = "";

        try {
            // Portafolio del usuario
            const portfolioData = await sql`
                SELECT 
                    p.name as portfolio_name,
                    pos.ticker, 
                    pos.quantity, 
                    pos.average_buy_price,
                    pos.asset_type,
                    pos.currency,
                    pos.updated_at
                FROM portfolios p
                LEFT JOIN positions pos ON p.id = pos.portfolio_id
                WHERE p.user_id = ${userId}
                ORDER BY p.name, pos.ticker
            `;

            if (portfolioData.length > 0 && portfolioData[0].ticker) {
                userContext += "\n📊 TU PORTAFOLIO:\n";
                const grouped: Record<string, any[]> = {};
                portfolioData.forEach(p => {
                    if (!grouped[p.portfolio_name]) grouped[p.portfolio_name] = [];
                    if (p.ticker) grouped[p.portfolio_name].push(p);
                });

                for (const [name, positions] of Object.entries(grouped)) {
                    userContext += `• ${name}:\n`;
                    userContext += positions.map(p =>
                        `   - ${p.ticker}: ${Number(p.quantity)} uds @ ${Number(p.average_buy_price).toFixed(2)} ${p.currency} (Últ. mov: ${new Date(p.updated_at).toLocaleDateString('es-ES')})`
                    ).join('\n');
                    userContext += '\n';
                }
            }

            // Alertas activas
            const alerts = await sql`
                SELECT ticker, condition, target_price 
                FROM alerts 
                WHERE user_id = ${userId} AND is_active = true
                LIMIT 5
            `;

            if (alerts.length > 0) {
                userContext += "\n🔔 TUS ALERTAS ACTIVAS:\n";
                alerts.forEach(a => {
                    userContext += `• ${a.ticker}: ${a.condition} ${a.target_price}\n`;
                });
            }

            // Próximos eventos del calendario (7 días)
            /* 
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);

            const events = await sql`
                SELECT ticker, event_type, event_date, title 
                FROM calendar_events 
                WHERE user_id = ${userId} 
                AND event_date >= CURRENT_DATE 
                AND event_date <= ${nextWeek.toISOString().split('T')[0]}
                ORDER BY event_date
                LIMIT 5
            `;

            if (events.length > 0) {
                userContext += "\n📅 PRÓXIMOS EVENTOS (7 días):\n";
                events.forEach(e => {
                    const date = new Date(e.event_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
                    userContext += `• ${date}: ${e.title} (${e.ticker || e.event_type})\n`;
                });
            }
            */
        } catch (e) {
            console.error('Error getting user context:', e);
        }

        // 2. Detectar si pide análisis completo del portafolio
        const lastMsgLower = lastUserMessage.toLowerCase();
        const wantsFullAnalysis =
            lastMsgLower.includes('todas mis posiciones') ||
            lastMsgLower.includes('todo mi portafolio') ||
            lastMsgLower.includes('analiza mi portafolio') ||
            lastMsgLower.includes('analiza mi cartera') ||
            lastMsgLower.includes('todas las posiciones') ||
            lastMsgLower.includes('análisis completo') ||
            lastMsgLower.includes('todos mis activos');

        // 3. Obtener tickers del portafolio del usuario (siempre, para priorizar)
        let portfolioTickers: string[] = [];
        try {
            const portfolioData = await sql`
                SELECT DISTINCT pos.ticker 
                FROM positions pos
                JOIN portfolios p ON pos.portfolio_id = p.id
                WHERE p.user_id = ${userId} AND pos.ticker IS NOT NULL
            `;
            portfolioTickers = portfolioData.map(p => p.ticker);
        } catch (e) {
            console.error('Error getting portfolio tickers:', e);
        }

        // 4. Detectar tickers: Priorizar el último mensaje + Contexto general
        const conversationContextText = messages.slice(-6).map(m => m.text).join(' ').toUpperCase();


        // 4.1 "Database First" Detection (User Suggestion)
        let dbMatches: string[] = [];
        try {
            const knownTickers = await MarketDataService.getKnownTickers();
            const upperMsg = lastUserMessage.toUpperCase();
            // Find any known ticker that appears in the last message
            dbMatches = knownTickers.filter(k => {
                // Use word boundary check to avoid partial matches (e.g. "I" in "AI")
                // but be careful with special chars. simpler: check if word exists
                // split by non-alphanumeric?
                const words = upperMsg.split(/[^A-Z0-9.]+/);
                return words.includes(k.toUpperCase());
            });
            if (dbMatches.length > 0) {

            }
        } catch (e) {
            console.error('[ChatBot] Error in DB-First detection:', e);
        }

        const lastMsgTickers = (lastUserMessage.toUpperCase().match(/\b[A-Z]{2,6}(\.[A-Z]{2,3})?\b/g) || []);
        const contextTickers = (conversationContextText.match(/\b[A-Z]{2,6}(\.[A-Z]{2,3})?\b/g) || []);

        // Merge: DB Matches (Highest Priority) > Last Message (Regex) > Context (Regex)
        const allMatches = [...dbMatches, ...lastMsgTickers, ...contextTickers];

        const commonTokens = [
            'HOLA', 'PARA', 'COMO', 'ESTA', 'TODO', 'BIEN', 'PERO', 'DONDE', 'CUANDO', 'QUE', 'TIENE', 'CREO', 'ESTE', 'ESE', 'POR', 'CON', 'LOS', 'LAS', 'UNA', 'UNO', 'MIS', 'TUS', 'SUS', 'HAY', 'VER', 'DEL', 'SOY', 'TENGO', 'PUEDO', 'QUIERO', 'DECIR', 'SOBRE', 'STOCKS', 'BOT', 'RMINOS', 'DARTE', 'ANALIZAR',
            'CUALES', 'SON', 'LAS', 'DE', 'DEL', 'EL', 'LA', 'UN', 'UNA', 'UNOS', 'UNAS', 'YO', 'TU', 'SU', 'NOS', 'OS', 'LES', 'MI', 'TI', 'SI', 'NO', 'Y', 'O', 'U', 'A', 'E',
            'DICEN', 'DICE', 'HABLAN', 'HABLA', 'OPINAN', 'OPINA', 'ANALISTAS', 'EXPERTOS', 'GURUS', 'INVERSORES', 'TRADERS',
            'NOTICIAS', 'NOVEDADES', 'SUCESOS', 'EVENTOS', 'HECHOS', 'DATOS', 'INFO', 'INFORMACION',
            'PRECIO', 'VALOR', 'COTIZACION', 'COSTE', 'COSTO', 'DINERO', 'EUROS', 'DOLARES', 'USD', 'EUR',
            'MERCADO', 'BOLSA', 'WALL', 'STREET', 'IBEX', 'NASDAQ', 'DOW', 'JONES', 'SP500',
            'ACCION', 'ACCIONES', 'TITULO', 'TITULOS', 'VALORES', 'ACTIVOS', 'EMPRESAS', 'COMPAÑIAS',
            'COMPRAR', 'VENDER', 'MANTENER', 'SUBIR', 'BAJAR', 'GANAR', 'PERDER', 'INVERTIR', 'OPERAR',
            'AHORA', 'HOY', 'AYER', 'MAÑANA', 'ANTES', 'DESPUES', 'SIEMPRE', 'NUNCA', 'TARDE', 'PRONTO',
            'GRACIAS', 'PORFAVOR', 'HOLA', 'ADIOS', 'HASTA', 'LUEGO', 'SALUDOS',
            'ALGO', 'NADA', 'MUCHO', 'POCO', 'BASTANTE', 'DEMASIADO', 'MAS', 'MENOS', 'TOTAL', 'IGUAL',
            'BUENO', 'MALO', 'MEJOR', 'PEOR', 'GRAN', 'PEQUEÑO', 'ALTO', 'BAJO'
        ];

        let mentionedTickers = [...new Set(allMatches.filter(t => !commonTokens.includes(t)))];


        // Priorizar tickers del portafolio: si el usuario dice "DIA" y tiene "DIA.MC", usar "DIA.MC"
        let tickersToAnalyze: string[] = [];
        // console.log('User portfolio tickers:', portfolioTickers);
        // console.log('Mentioned tickers raw:', mentionedTickers);

        for (const mentioned of mentionedTickers) {
            // Buscar coincidencia exacta o parcial en portafolio
            const portfolioMatch = portfolioTickers.find(pt =>
                pt === mentioned || pt.startsWith(mentioned + '.')
            );

            if (portfolioMatch) {
                tickersToAnalyze.push(portfolioMatch);
            } else {
                tickersToAnalyze.push(mentioned);
            }
        }
        tickersToAnalyze = [...new Set(tickersToAnalyze)];

        // Si pide análisis completo, añadir todos los tickers del portafolio
        if (wantsFullAnalysis) {
            tickersToAnalyze = [...new Set([...tickersToAnalyze, ...portfolioTickers])];
        }

        let marketDataStr = "";
        let newsDataStr = ""; // Block for {{NEWS_CONTEXT}}

        // 4. Obtener datos de mercado - más tickers si es análisis completo
        const maxTickers = wantsFullAnalysis ? 15 : 4;

        if (tickersToAnalyze.length > 0) {
            marketDataStr += "\n📈 DATOS DE MERCADO:\n";
            // We fetch keys for all analyzed tickers
            for (const ticker of tickersToAnalyze.slice(0, maxTickers)) {
                try {
                    // Parallelize data fetching (Full Pack)
                    const [history, quote, news, analysts, peers, insider] = await Promise.all([
                        MarketDataService.getDetailedHistory(ticker, 1),
                        MarketDataService.getQuote(ticker),
                        MarketDataService.getCompanyNews(ticker),
                        MarketDataService.getAnalystRecommendations(ticker),
                        MarketDataService.getPeers(ticker),
                        MarketDataService.getInsiderSentiment(ticker)
                    ]);

                    if (quote) {
                        const currencySymbol = quote?.currency === 'EUR' ? '€' : quote?.currency === 'GBP' ? '£' : '$';
                        const quoteTime = new Date(quote.lastUpdated || Date.now()).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

                        marketDataStr += `\n📌 ANÁLISIS PARA ${ticker} (${quote.name}):\n`;
                        marketDataStr += `PRECIO (aprox ${quoteTime}): ${currencySymbol}${quote.c.toFixed(2)} (${quote.dp >= 0 ? '+' : ''}${quote.dp.toFixed(2)}%)\n`;

                        // FUNDAMENTALES
                        marketDataStr += `FUNDAMENTALES:\n`;
                        marketDataStr += `- Cap: ${quote.marketCap || 'N/A'} | Beta: ${quote.beta || 'N/A'}\n`;
                        marketDataStr += `- PER: ${quote.peRatio || 'N/A'} | EPS: N/A\n`; // EPS not yet in QuoteResult but handy
                        marketDataStr += `- Próx. Resultados: ${quote.earningsDate || 'N/A'}\n`;

                        if (quote.targetMeanPrice) {
                            marketDataStr += `- Objetivo Analistas: ${currencySymbol}${quote.targetMeanPrice} (Consenso: ${quote.recommendationKey || 'N/A'})\n`;
                        } else if (analysts) {
                            // Fallback to Finnhub Analysts
                            const buy = analysts.buy + analysts.strongBuy;
                            const sell = analysts.sell + analysts.strongSell;
                            marketDataStr += `- Consenso Analistas (Finnhub): ${buy} Comprar / ${analysts.hold} Mantener / ${sell} Vender\n`;
                        }

                        // TÉCNICO
                        if (history && history.length > 15) {
                            const prices = history.map(h => Number(h.close));
                            const tech = MarketDataService.getTechnicalIndicators(prices);

                            if (tech) {
                                marketDataStr += `TÉCNICO (Calculado):\n`;
                                marketDataStr += `- RSI (14): ${tech.rsi} (${tech.rsi > 70 ? '⚠️ SOBRECOMPRA' : tech.rsi < 30 ? '⚠️ SOBREVENTA' : 'Neutral'})\n`;
                                marketDataStr += `- Tendencia: ${tech.trend}\n`;
                                marketDataStr += `- Medias: SMA50 ${currencySymbol}${tech.sma50 || 'N/A'} | SMA200 ${currencySymbol}${tech.sma200 || 'N/A'}\n`;
                            }
                        }

                        // INSIGHTS (Finnhub)
                        let insights = "";
                        if (peers && peers.length > 0) insights += `- Competencia: ${peers.slice(0, 5).join(', ')}\n`;
                        if (insider) insights += `- Insider Sentiment (3m): ${insider.label} (MSPR: ${insider.mspr.toFixed(2)})\n`;

                        if (insights) {
                            marketDataStr += `INSIGHTS:\n${insights}`;
                        }

                        marketDataStr += `- Rango 52sem: ${currencySymbol}${quote.yearLow || 'N/A'} - ${currencySymbol}${quote.yearHigh || 'N/A'}\n`;
                    }

                    // Add News to NEWS BLOCK
                    if (news && news.length > 0) {
                        newsDataStr += `\n📰 NOTICIAS RECIENTES (${ticker}):\n`;
                        news.slice(0, 6).forEach((n: any) => {
                            newsDataStr += `- [${n.timeStr}] ${n.title} (${n.publisher})\n`;
                        });
                    }

                } catch (e) {
                    console.error(`ChatBot: Error fetching data for ${ticker}`, e);
                }
            }
        }

        // 4.1 Discovery Engine Data (Global Context)
        try {
            const discoveryStats = await DiscoveryService.getAllDiscoveryData();
            if (discoveryStats && Object.keys(discoveryStats).length > 0) {
                marketDataStr += "\n📡 RADAR DE MERCADO (Discovery Engine):\n";

                // Trending
                const trendingKey = discoveryStats['trending_global'] ? 'trending_global' : (discoveryStats['day_gainers'] ? 'day_gainers' : null);

                if (trendingKey) {
                    const trends = discoveryStats[trendingKey].slice(0, 5).map((i: any) => {
                        const isOwned = portfolioTickers.includes(i.t);
                        return `${i.t} (${i.chg_1d > 0 ? '+' : ''}${i.chg_1d.toFixed(1)}%${isOwned ? ' ✅' : ''})`;
                    }).join(', ');
                    marketDataStr += `🔥 Tendencia Global: ${trends}\n`;
                }

                // Sectors
                const sectors = Object.keys(discoveryStats).filter(k => k.startsWith('sector_')).map(k => k.replace('sector_', '')).join(', ');
                if (sectors) marketDataStr += `🏗️ Sectores Rastreados: ${sectors} (Datos disponibles si el usuario pregunta)\n`;
            }
        } catch (e) {
            console.error('AI Discovery Context Error:', e);
        }

        if (!newsDataStr) {
            newsDataStr = "No hay noticias recientes relevantes para los activos mencionados.";
        }

        // 4. Historial de conversación (últimos 8 mensajes)
        const chatHistoryStr = messages.slice(-8).map(m => `${m.role === 'user' ? 'Tú' : 'Bot'}: ${m.text}`).join('\n');

        // 5. Prompt mejorado (Active Prompt from DB)
        let promptTemplate = "";
        try {
            const [activePrompt] = await sql`
                SELECT content FROM ai_prompts 
                WHERE prompt_type = 'CHATBOT' AND is_active = true 
                LIMIT 1
            `;
            if (activePrompt) {
                promptTemplate = activePrompt.content;
            }
        } catch (e) {
            console.error('Error fetching active chatbot prompt:', e);
        }

        if (!promptTemplate) {
            promptTemplate = `Eres un asesor financiero cercano y experto. Tu nombre es Stocks Bot.

ESTILO DE RESPUESTA:
- Habla como un colega experto, NO como un robot corporativo
- Tutea al usuario, sé directo y amigable
- Usa emojis con moderación donde tenga sentido (📈 📉 💡 ⚠️)
- ADAPTA la longitud de tu respuesta a la pregunta:
  • Preguntas simples ("¿cómo va AAPL?"): 1-2 oraciones
  • Preguntas de análisis ("¿qué opinas de mi portafolio?"): 3-5 oraciones  
  • Explicaciones o consejos detallados: hasta 300 palabras máximo
- Si no tienes datos sobre algo, dilo brevemente y sugiere alternativas
- No repitas información que ya dijiste en la conversación

DATOS DEL USUARIO:
{{USER_CONTEXT}}

DATOS DE MERCADO:
{{MARKET_DATA}}

NOTICIAS (Contexto Adicional):
{{NEWS_CONTEXT}}

ÚLTIMO MENSAJE DEL USUARIO:
{{USER_MESSAGE}}

CONVERSACIÓN:
{{CHAT_HISTORY}}

Responde al último mensaje del usuario de forma natural y útil.`;
        }

        const prompt = promptTemplate
            .replace('{{USER_CONTEXT}}', userContext || "No hay datos de portafolio disponibles.")
            .replace('{{MARKET_DATA}}', marketDataStr || "Sin datos de mercado relevantes.")
            .replace('{{NEWS_CONTEXT}}', newsDataStr)
            .replace('{{USER_MESSAGE}}', lastUserMessage)
            .replace('{{CHAT_HISTORY}}', chatHistoryStr);

        return prompt;
    },

    async chatWithBot(userId: string, messages: { role: string, text: string }[]) {
        const provider = await getProvider();
        if (!provider) {
            console.error('[ChatBot] Provider init failed.');
            return "El servicio de IA no está configurado.";
        }

        const prompt = await this._buildChatPrompt(userId, messages);

        try {
            const result = await provider.generateContent(prompt);
            return result;
        } catch (e: any) {
            console.error("AI Chat Error:", e);
            const errorMessage = e.message || JSON.stringify(e);

            // Handle API Key specific errors
            if (errorMessage.includes('API key') || errorMessage.includes('expired') || errorMessage.includes('401')) {
                console.error('🚨 [ADMIN ALERT] AI TOKEN EXPIRED.');
                NotificationService.notifyAdmin('AI API KEY ERROR', 'La API Key de Inteligencia Artificial ha fallado.');
                return "⚠️ **Problema Técnico Crítico** ⚠️\n\nFallo de autenticación con el proveedor de IA.\n\n👉 **Contacta al administrador**.";
            }

            // Handle Quota/Rate Limit Errors (429)
            if (errorMessage.includes('429') || errorMessage.includes('Quota') || errorMessage.includes('exhausted')) {
                console.error('🚨 [ADMIN ALERT] AI QUOTA EXCEEDED.');
                NotificationService.notifyAdmin('AI QUOTA EXCEEDED', 'Límite de cuota excedido en ChatBot.');
                return "⚠️ **Límite de Cuota Excedido** ⚠️\n\nEl proveedor de IA ha superado su límite. Intenta más tarde.";
            }

            // General Fallback
            return "Lo siento, tuve un problema técnico al procesar tu mensaje. Intenta de nuevo en unos momentos.";
        }
    },

    async chatWithBotStream(userId: string, messages: { role: string, text: string }[]) {
        const provider = await getProvider();
        if (!provider) {
            return async function* () { yield "Error: Servicio IA no configurado." }();
        }

        const prompt = await this._buildChatPrompt(userId, messages);

        try {
            const stream = await provider.generateStream(prompt);
            return stream;
        } catch (e: any) {
            console.error("AI Chat Stream Error:", e);
            const errorMessage = e.message || JSON.stringify(e);

            if (errorMessage.includes('API key') || errorMessage.includes('expired') || errorMessage.includes('401')) {
                console.error('🚨 [ADMIN ALERT] AI API KEY ERROR (Stream).');
                return async function* () {
                    yield "⚠️ **Problema Técnico**: Error de autenticación IA.";
                }();
            }

            if (errorMessage.includes('429') || errorMessage.includes('Quota') || errorMessage.includes('exhausted')) {
                console.error('🚨 [ADMIN ALERT] AI QUOTA EXCEEDED (Stream).');
                return async function* () {
                    yield "⚠️ **Límite de Cuota Excedido** ⚠️\n\nEl proveedor está saturado.";
                }();
            }

            return async function* () { yield `Error: ${e.message}`; }();
        }
    },

    async fetchAvailableModels() {
        // Now delegates to the active provider
        try {
            const provider = await getProvider();
            if (provider) {
                const models = await provider.getModels();
                // Cache if needed? The provider likely doesn't cache, but we can relies on frontend caching or simple re-fetch.
                // For now, let's store in DB as fallback or just return it.
                // The original method updated 'AI_AVAILABLE_MODELS' setting.
                if (models.length > 0) {
                    await SettingsService.set('AI_AVAILABLE_MODELS', JSON.stringify(models), false);
                }
                return models;
            }
        } catch (e: any) {
            console.error('Error fetching models from provider:', e);
        }
        return [];
    },

    async getAvailableModels() {
        // Try fetching fresh first (to ensure provider switch is reflected)
        const fresh = await this.fetchAvailableModels();
        if (fresh && fresh.length > 0) return fresh;

        const stored = await SettingsService.get('AI_AVAILABLE_MODELS');
        if (stored) {
            try { return JSON.parse(stored); } catch (e) { }
        }

        return [
            { id: 'default', name: 'Default Model (Fallback)' }
        ];
    }
};
