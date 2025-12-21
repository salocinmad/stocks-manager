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
            console.log('[AI] No API key available');
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
                    const history = await MarketDataService.getDetailedHistory(ticker, 2);

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

        // Obtener el último mensaje del usuario para responder a él
        const lastUserMessage = messages[messages.length - 1]?.text || "";

        // 1. Detectar tickers en TODA la conversación reciente (para mantener contexto)
        const conversationContextText = messages.slice(-6).map(m => m.text).join(' ');

        const commonTokens = ['HOLA', 'PARA', 'COMO', 'ESTA', 'TODO', 'BIEN', 'PERO', 'DONDE', 'CUANDO', 'QUE', 'TIENE', 'CREO', 'ESTE', 'ESE', 'POR', 'CON', 'LOS', 'LAS', 'UNA', 'UNO'];
        const matches = conversationContextText.match(/\b[A-Z]{2,6}(\.[A-Z]{2,3})?\b/g) || [];
        const tickersInContext = [...new Set(matches.filter(t => !commonTokens.includes(t)))];

        let marketDataStr = "";

        // 2. Obtener datos para los tickers mencionados
        if (tickersInContext.length > 0) {
            marketDataStr += "\n--- DATOS DE MERCADO (CONTEXTO) ---\n";
            for (const ticker of tickersInContext) {
                try {
                    const history = await MarketDataService.getDetailedHistory(ticker, 1);

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

                        marketDataStr += `\nTicker: ${ticker}\n`;
                        marketDataStr += `- Precio Último: ${Number(last.close).toFixed(2)} (${new Date(last.date).toISOString().split('T')[0]})\n`;
                        marketDataStr += `- Variación Diaria: ${changeStr}\n`;
                        marketDataStr += `- Rango Anual: ${min} - ${max}\n`;

                        const last20 = prices.slice(-20);
                        const support = Math.min(...last20).toFixed(2);
                        const resistance = Math.max(...last20).toFixed(2);
                        marketDataStr += `- Soporte CP (20d): ${support}, Resistencia CP (20d): ${resistance}\n`;
                    }
                } catch (e) {
                    console.error(`ChatBot: Error fetching data for ${ticker}`, e);
                }
            }
        }

        const chatHistoryStr = messages.slice(-10).map(m => `${m.role === 'user' ? 'Usuario' : 'Bot'}: ${m.text}`).join('\n');

        // 3. Prompt Conversacional desde DB
        let promptTemplate = await SettingsService.get('AI_PROMPT_CHATBOT');
        if (!promptTemplate) {
            promptTemplate = `Eres "Stocks Bot", un asistente financiero conversacional experto.
            
HISTORIAL DE CONVERSACIÓN RECIENTE:
{{CHAT_HISTORY}}

DATOS DE MERCADO DISPONIBLES (Contexto):
{{MARKET_DATA}}

Instrucciones:
1. Tu tarea actual es responder al ÚLTIMO mensaje del usuario (en el historial).
2. Usa el historial para entender de qué ticker se está hablando si no se menciona explícitamente en el último mensaje.
3. Si preguntan por soportes/resistencias, usa los datos contextuales proporcionados (Soporte CP / Resistencia CP o Rango Anual).
4. Mantén tus respuestas conversacionales y útiles.`;
        }

        const prompt = promptTemplate
            .replace('{{CHAT_HISTORY}}', chatHistoryStr)
            .replace('{{MARKET_DATA}}', marketDataStr);

        try {
            const result = await currentModel.generateContent(prompt);
            return result.response.text();
        } catch (e: any) {
            console.error("AI Chat Error:", e);
            if (e.message?.includes('API key') || e.message?.includes('401')) {
                cachedApiKey = null;
                model = null;
            }
            return "Lo siento, tuve un problema interno al procesar tu mensaje.";
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
