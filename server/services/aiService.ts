import { GoogleGenerativeAI } from "@google/generative-ai";
import sql from '../db';
import { MarketDataService } from './marketData';
import { SettingsService } from './settingsService';

// Cache del cliente de IA para evitar recrearlo en cada llamada si la config no cambió
let cachedApiKey: string | null = null;
let cachedModelName: string | null = null;
let genAI: GoogleGenerativeAI | null = null;
let model: any = null;

// Función asíncrona para obtener o recrear el modelo con la configuración actual
const getModel = async () => {
    const currentApiKey = process.env.GOOGLE_GENAI_API_KEY;
    const currentModelName = process.env.AI_MODEL || "gemini-1.5-flash";

    // Si la API key cambió, el modelo cambió, o no existe instancia, recrear
    if (currentApiKey !== cachedApiKey || currentModelName !== cachedModelName || !model) {
        cachedApiKey = currentApiKey || null;
        cachedModelName = currentModelName;

        if (currentApiKey) {
            // console.log(`[AI] Initializing with Model: ${currentModelName} & Key length: ${currentApiKey.length}`);
            genAI = new GoogleGenerativeAI(currentApiKey);
            model = genAI.getGenerativeModel({ model: currentModelName });
        } else {

            genAI = null;
            model = null;
        }
    }

    return model;
};

export const AIService = {
    async analyzePortfolio(userId: string, userMessage: string) {
        const currentModel = await getModel();

        if (!currentModel) {
            return "El servicio de IA no está configurado (Falta API Key). Ve a Ajustes > Configuración de API para añadir tu Google Gemini API Key.";
        }


        // 1. Fetch Context
        const portfolios = await sql`
        SELECT p.name, pos.ticker, pos.quantity, pos.average_buy_price, pos.asset_type 
        FROM portfolios p
        JOIN positions pos ON p.id = pos.portfolio_id
        WHERE p.user_id = ${userId}
    `;

        const portfolioSummary = portfolios.map(p =>
            `- ${p.ticker} (${p.asset_type}): ${p.quantity} unidades @ ${p.average_buy_price}`
        ).join('\n');

        // 2. Enrich with Historical Data
        const potentialTickersInMessage = (userMessage.match(/\b[A-Z]{2,6}\b/g) || [])
            .filter(t => !['HOLA', 'PARA', 'COMO', 'ESTA', 'TODO', 'BIEN', 'PERO', 'DONDE', 'CUANDO'].includes(t));

        const portfolioTickers = portfolios.map(p => p.ticker);
        const relevantTickers = Array.from(new Set([...potentialTickersInMessage, ...portfolioTickers]));

        let marketContext = "";

        // Procesar máximo 5 tickers para no exceder contexto
        if (relevantTickers.length > 0) {
            marketContext += "\n--- DATOS DE MERCADO EN TIEMPO REAL E HISTÓRICOS ---\n";


            for (const ticker of relevantTickers.slice(0, 5)) {
                try {
                    // Obtener 2 años de historia
                    const sanitizedTicker = ticker.trim().toUpperCase();
                    const history = await MarketDataService.getDetailedHistory(sanitizedTicker, 2);


                    if (history && history.length > 0) {
                        const last = history[history.length - 1];
                        const oneYearAgo = history.find(h => new Date(h.date) <= new Date(Date.now() - 365 * 24 * 3600 * 1000)) || history[0];
                        const change1Y = ((last.close - oneYearAgo.close) / oneYearAgo.close * 100).toFixed(2);

                        const sampledPrices = history
                            .filter((_, index) => index % 20 === 0 || index === history.length - 1)
                            .map(h => `${new Date(h.date).toISOString().split('T')[0]}:${Number(h.close).toFixed(2)}`)
                            .join(', ');

                        marketContext += `\nTicker: ${ticker}\n`;
                        marketContext += `- Precio Actual (Ref): ${Number(last.close).toFixed(2)} (al ${new Date(last.date).toISOString().split('T')[0]})\n`;
                        marketContext += `- Rendimiento 1 Año: ${change1Y}%\n`;
                        marketContext += `- Curva de Precios (Fecha:Precio): [${sampledPrices}]\n`;
                    } else {
                        console.warn(`[AIService] No history found for ${ticker}`);
                    }
                } catch (err) {
                    console.error(`Error fetching AI context for ${ticker}`, err);
                }
            }
        }

        // 3. Construct Prompt using Template from DB
        let promptTemplate = await SettingsService.get('AI_PROMPT_ANALYSIS');
        if (!promptTemplate) {
            promptTemplate = `Actúa como "Stocks Bot", un Analista Financiero Senior experto de Wall Street creado para esta plataforma.

CONTEXTO DEL PORTAFOLIO DEL CLIENTE:
{{PORTFOLIO_CONTEXT}}

{{MARKET_CONTEXT}}

Pregunta del usuario: "{{USER_MESSAGE}}"

INSTRUCCIONES:
- Responde en español, de forma profesional, concisa y basada en los DATOS proporcionados arriba.
- Si ves una "Curva de Precios", analízala brevemente (tendencia alcista/bajista, volatilidad).
- Da consejos estratégicos sobre diversificación y riesgo si aplica.
- Si te preguntan por una acción cuyos datos acabas de recibir (arriba), úsalos para opinar.
- Identifícate siempre como Stocks Bot.`;
        }

        const prompt = promptTemplate
            .replace('{{PORTFOLIO_CONTEXT}}', portfolioSummary || "Portafolio vacío por el momento.")
            .replace('{{MARKET_CONTEXT}}', marketContext)
            .replace('{{USER_MESSAGE}}', userMessage);

        try {
            const result = await currentModel.generateContent(prompt);
            return result.response.text();
        } catch (e: any) {
            console.error("AI Error Detailed:", e);
            console.error("AI Error Message:", e.message);

            if (e.message?.includes('API key') || e.message?.includes('401') || e.message?.includes('403')) {
                cachedApiKey = null;
                model = null;
            }

            return `Lo siento, hubo un error al procesar tu consulta financiera: ${e.message || 'Error desconocido'}`;
        }
    },

    // Método específico para el ChatBot (Conversacional con Memoria)
    async chatWithBot(userId: string, messages: { role: string, text: string }[]) {
        const currentModel = await getModel();
        if (!currentModel) return "El servicio de IA no está configurado.";

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
                    pos.currency
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
                    userContext += `• ${name}: `;
                    userContext += positions.map(p => `${p.ticker} (${p.quantity})`).join(', ');
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
            'HOLA', 'PARA', 'COMO', 'ESTA', 'TODO', 'BIEN', 'PERO', 'DONDE', 'CUANDO', 'QUE', 'TIENE', 'CREO', 'ESTE', 'ESE', 'POR', 'CON', 'LOS', 'LAS', 'UNA', 'UNO', 'MIS', 'TUS', 'SUS', 'HAY', 'VER', 'DEL', 'SOY', 'Tengo', 'PUEDO', 'QUIERO', 'DECIR', 'SOBRE', 'STOCKS', 'BOT', 'RMINOS', 'DARTE', 'ANALIZAR'
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
        console.log('[ChatBot] Final tickers to analyze:', tickersToAnalyze);

        // Si pide análisis completo, añadir todos los tickers del portafolio
        if (wantsFullAnalysis) {
            tickersToAnalyze = [...new Set([...tickersToAnalyze, ...portfolioTickers])];
            console.log('[ChatBot] Full Analysis Requested. Total tickers:', tickersToAnalyze.length);
        }

        let marketDataStr = "";

        // 4. Obtener datos de mercado - más tickers si es análisis completo
        const maxTickers = wantsFullAnalysis ? 15 : 4;
        if (tickersToAnalyze.length > 0) {
            marketDataStr += "\n📈 DATOS DE MERCADO:\n";
            for (const ticker of tickersToAnalyze.slice(0, maxTickers)) {
                try {
                    console.log(`[ChatBot] Fetching history for ${ticker}...`);
                    const history = await MarketDataService.getDetailedHistory(ticker, 1);
                    console.log(`[ChatBot] History for ${ticker}: ${history?.length} rows`);

                    if (history && history.length > 0) {
                        const last = history[history.length - 1];
                        const prev = history[history.length - 2];
                        let changeStr = "";

                        if (prev && prev.close > 0) {
                            const change = ((last.close - prev.close) / prev.close * 100);
                            changeStr = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
                        }

                        const prices = history.map(h => Number(h.close));
                        const min = Math.min(...prices).toFixed(2);
                        const max = Math.max(...prices).toFixed(2);
                        const lastDate = new Date(last.date).toISOString().split('T')[0];

                        // Add detailed context for the AI
                        const last5 = history.slice(-5).map(h => `${new Date(h.date).toLocaleDateString()}: $${Number(h.close).toFixed(2)}`).join(' | ');

                        marketDataStr += `\n📌 ANÁLISIS PARA ${ticker}:\n`;
                        marketDataStr += `- Precio Actual: $${Number(last.close).toFixed(2)} (${changeStr})\n`;
                        marketDataStr += `- Fecha Referencia: ${lastDate}\n`;
                        marketDataStr += `- Rango 52 semanas: $${min} - $${max}\n`;
                        marketDataStr += `- Últimos 5 cierres: ${last5}\n`;

                        // Add trend context (sampled)
                        const trend = history
                            .filter((_, i) => i % 10 === 0 || i === history.length - 1)
                            .map(h => Number(h.close).toFixed(1))
                            .join(' -> ');
                        marketDataStr += `- Tendencia (Muestreo): ${trend}\n`;

                    } else {
                        console.warn(`[ChatBot] No history returned for ${ticker}`);
                    }
                } catch (e) {
                    console.error(`ChatBot: Error fetching data for ${ticker}`, e);
                }
            }
        } else {

        }

        // 4. Historial de conversación (últimos 8 mensajes)
        const chatHistoryStr = messages.slice(-8).map(m => `${m.role === 'user' ? 'Tú' : 'Bot'}: ${m.text}`).join('\n');

        // 5. Prompt mejorado
        let promptTemplate = await SettingsService.get('AI_PROMPT_CHATBOT');
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

CONVERSACIÓN:
{{CHAT_HISTORY}}

Responde al último mensaje del usuario de forma natural y útil.`;
        }

        const prompt = promptTemplate
            .replace('{{USER_CONTEXT}}', userContext || "No hay datos de portafolio disponibles.")
            .replace('{{MARKET_DATA}}', marketDataStr || "Sin datos de mercado relevantes.")
            .replace('{{CHAT_HISTORY}}', chatHistoryStr);

        try {
            const result = await currentModel.generateContent(prompt);
            return result.response.text();
        } catch (e: any) {
            console.error("AI Chat Error:", e);
            if (e.message?.includes('API key') || e.message?.includes('401')) {
                cachedApiKey = null;
                model = null;
            }
            return "Lo siento, tuve un problema al procesar tu mensaje. Intenta de nuevo.";
        }
    },

    async fetchAvailableModels() {
        let apiKey = await SettingsService.get('GOOGLE_GENAI_API_KEY') || process.env.GOOGLE_GENAI_API_KEY;
        if (!apiKey) throw new Error('No hay API Key configurada');

        apiKey = apiKey.trim(); // Sanitize key

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            // Manejar errores de API limpiamente para no crashear
            if (!response.ok) {
                const errText = await response.text();
                console.warn(`[AI] Google API Error fetching models: ${response.status} ${response.statusText} - ${errText}`);
                throw new Error(`Google API: ${response.statusText}`);
            }

            const data = await response.json();
            const models = (data.models || [])
                .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
                .map((m: any) => ({
                    id: m.name.replace('models/', ''),
                    name: `${m.displayName} (${m.version})`
                }))
                .sort((a: any, b: any) => b.id.localeCompare(a.id));

            await SettingsService.set('AI_AVAILABLE_MODELS', JSON.stringify(models), false);
            return models;
        } catch (e: any) {
            console.error('Error fetching models:', e.message);
            throw new Error('No se pudieron obtener los modelos de Google: ' + e.message);
        }
    },

    async getAvailableModels() {
        const stored = await SettingsService.get('AI_AVAILABLE_MODELS');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) { console.error('Error parsing stored models', e); }
        }
        try {
            return await this.fetchAvailableModels();
        } catch (e) {
            console.warn('[AI] Using fallback models due to fetch error');
            return [
                { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Fallback)' },
                { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Fallback)' },
                { id: 'gemini-pro', name: 'Gemini Pro (Fallback)' }
            ];
        }
    }
};
