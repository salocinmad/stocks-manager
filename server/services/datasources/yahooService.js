/**
 * Servicio Yahoo Finance - API de precios y datos históricos
 * Usa fetch directo como el legacy system (routes/yahoo.js)
 * La librería yahoo-finance2 tiene problemas de conectividad en Docker
 */

import { getPreviousMarketDay } from '../../utils/dateHelpers.js';
import { getLogLevel } from '../configService.js';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

/**
 * Obtiene quote de Yahoo Finance usando fetch directo
 * @param {string} symbol - Símbolo bursátil
 * @returns {Promise<Object|null>} Datos de precio o null
 */
export async function fetchQuote(symbol) {
    const currentLogLevel = await getLogLevel();
    try {
        // CRITICAL: Yahoo usa punto (.) no dos puntos (:) para mercados internacionales
        // DB tiene: OHLA:MC, DIA:MC, AMP:MC
        // Yahoo requiere: OHLA.MC, DIA.MC, AMP.MC
        const yahooSymbol = symbol.replace(/:/g, '.');

        if (currentLogLevel === 'verbose') {
            console.log(`📞 Yahoo API (fetch directo) para '${symbol}' → '${yahooSymbol}'...`);
        }

        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`;

        const response = await fetch(yahooUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });

        if (!response.ok) {
            if (currentLogLevel === 'verbose') {
                console.log(`⚠️  Yahoo ${symbol}: HTTP ${response.status}`);
            }
            return null;
        }

        const data = await response.json();

        if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
            if (currentLogLevel === 'verbose') {
                console.log(`⚠️  Yahoo ${symbol}: No data in chart`);
            }
            return null;
        }

        const result = data.chart.result[0];
        const meta = result.meta;
        const quote = result.indicators?.quote?.[0];

        if (!meta || !meta.regularMarketPrice) {
            if (currentLogLevel === 'verbose') {
                console.log(`⚠️  Yahoo ${symbol}: No regularMarketPrice`);
            }
            return null;
        }

        const lastPrice = meta.regularMarketPrice;

        // DEBUG: Ver todos los campos disponibles de previousClose
        if (currentLogLevel === 'verbose') {
            console.log(`🔍 ${symbol} previousClose fields:`, {
                chartPreviousClose: meta.chartPreviousClose,
                previousClose: meta.previousClose,
                regularMarketPreviousClose: meta.regularMarketPreviousClose
            });
        }

        const previousClose = meta.regularMarketPreviousClose || meta.chartPreviousClose || meta.previousClose;
        const change = previousClose ? (lastPrice - previousClose) : 0;
        const changePercent = previousClose > 0 ? ((change / previousClose) * 100) : 0;

        if (currentLogLevel === 'verbose') {
            console.log(`💰 ${symbol}: price=${lastPrice}, prevClose=${previousClose}, change=${change}, change%=${changePercent.toFixed(2)}%`);
        }

        // Obtener OHLC del último dato disponible
        const lastIndex = quote?.close?.length - 1;
        const open = lastIndex >= 0 ? quote.open?.[lastIndex] : null;
        const high = lastIndex >= 0 ? quote.high?.[lastIndex] : null;
        const low = lastIndex >= 0 ? quote.low?.[lastIndex] : null;
        const volume = lastIndex >= 0 ? quote.volume?.[lastIndex] : null;

        const resultData = {
            lastPrice: lastPrice,
            change: change || 0,
            changePercent: changePercent || 0,
            open: open || null,
            high: high || null,
            low: low || null,
            volume: volume || null,
            previousClose: previousClose || null,
            previousCloseDate: getPreviousMarketDay(),
            marketState: meta.marketState || 'CLOSED',
            currency: meta.currency || 'USD',
            exchange: meta.exchangeName || null,
            regularMarketTime: meta.regularMarketTime
                ? new Date(meta.regularMarketTime * 1000)
                : new Date()
        };

        if (currentLogLevel === 'verbose') {
            console.log(`✅ Yahoo ${symbol}: ${resultData.lastPrice} (${resultData.currency})`);
        }
        return resultData;

    } catch (error) {
        if (currentLogLevel === 'verbose') {
            console.error(`❌ Yahoo ${symbol} EXCEPTION:`, error.message);
        }
        return null;
    }
}

/**
 * Obtiene datos históricos de Yahoo Finance
 * @param {string} symbol - Símbolo bursátil
 * @param {number} days - Días hacia atrás
 * @returns {Promise<Array>} Array de datos históricos
 */
export async function fetchHistorical(symbol, days = 365) {
    const currentLogLevel = await getLogLevel();
    try {
        const parts = symbol.split('|||');
        let yahooSymbol = parts[parts.length - 1]; // Obtener la última parte (el ticker)
        yahooSymbol = yahooSymbol.replace(/:/g, '.'); // Reemplazar ':' por '.' si existe
        if (currentLogLevel === 'verbose') {
            console.error(`ERROR_DEBUG: Símbolo de Yahoo convertido: ${yahooSymbol}`);
        }

        const endDate = Math.floor(Date.now() / 1000);
        const startDate = endDate - (days * 24 * 60 * 60);

        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?period1=${startDate}&period2=${endDate}&interval=1d`;
        if (currentLogLevel === 'verbose') {
            console.error(`ERROR_DEBUG: URL de la API de Yahoo Finance: ${url}`);
        }

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });
        if (currentLogLevel === 'verbose') {
            console.error(`ERROR_DEBUG: Respuesta de la API de Yahoo Finance - Estado: ${response.status}`);
        }

        if (!response.ok) {
            if (currentLogLevel === 'verbose') {
                console.log(`⚠️  Yahoo historical ${symbol}: HTTP ${response.status}`);
            }
            return [];
        }

        const data = await response.json();
        const result = data.chart?.result?.[0];

        if (!result) {
            if (currentLogLevel === 'verbose') {
                console.log(`⚠️  Yahoo historical ${symbol}: No data in chart result`);
            }
            return [];
        }

        const timestamps = result.timestamp || [];
        const quote = result.indicators?.quote?.[0] || {};

        const historicalData = timestamps.map((timestamp, i) => ({
            date: new Date(timestamp * 1000).toISOString().split('T')[0],
            open: quote.open?.[i] || null,
            high: quote.high?.[i] || null,
            low: quote.low?.[i] || null,
            close: quote.close?.[i] || null,
            volume: quote.volume?.[i] || null,
            adjClose: result.indicators?.adjclose?.[0]?.adjclose?.[i] || null
        })).filter(day => day.close !== null);

        if (currentLogLevel === 'verbose') {
            console.log(`✅ Yahoo historical ${symbol}: ${historicalData.length} registros obtenidos.`);
        }
        return historicalData;

    } catch (error) {
        if (currentLogLevel === 'verbose') {
            console.error(`❌ Yahoo historical ${symbol}:`, error.message);
        }
        return [];
    }
}

/**
 * Obtiene dividendos históricos de Yahoo Finance
 * @param {string} symbol - Símbolo bursátil
 * @param {number} days - Días hacia atrás
 * @returns {Promise<Array>} Array de dividendos
 */
export async function fetchDividends(symbol, days = 180) {
    try {
        const parts = symbol.split('|||');
        let yahooSymbol = parts[parts.length - 1].replace(/:/g, '.');
        const now = Math.floor(Date.now() / 1000);
        const start = now - (days * 24 * 60 * 60);
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?period1=${start}&period2=${now}&interval=1d&events=div`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });

        if (!response.ok) return [];

        const data = await response.json();
        const divs = data.chart?.result?.[0]?.events?.dividends;

        if (!divs) return [];

        return Object.values(divs).map(d => ({
            date: new Date(d.date * 1000).toISOString().split('T')[0],
            amount: d.amount
        })).sort((a, b) => b.date.localeCompare(a.date));
    } catch (error) {
        return [];
    }
}

/**
 * Obtiene perfil del activo (Sector, Industria, Beta, Dividendos)
 * @param {string} symbol - Símbolo bursátil
 * @returns {Promise<Object|null>} Datos del perfil
 */
export async function fetchAssetProfile(symbol) {
    const currentLogLevel = await getLogLevel();
    try {
        const parts = symbol.split('|||');
        let yahooSymbol = parts[parts.length - 1];
        yahooSymbol = yahooSymbol.replace(/:/g, '.');

        const result = await yahooFinance.quoteSummary(yahooSymbol, {
            modules: ['assetProfile', 'summaryDetail', 'defaultKeyStatistics']
        });

        if (!result) {
            return null;
        }

        const profile = result.assetProfile || {};
        const stats = result.defaultKeyStatistics || {};
        const summary = result.summaryDetail || {};

        const profileData = {
            symbol: symbol,
            sector: profile.sector || 'Unknown',
            industry: profile.industry || 'Unknown',
            beta: stats.beta || null,
            dividendYield: summary.dividendYield ? (summary.dividendYield * 100) : null,
            marketCap: summary.marketCap || null,
            currency: summary.currency || null,
            description: profile.longBusinessSummary || null,
            website: profile.website || null,
            updatedAt: new Date()
        };

        return profileData;

    } catch (error) {
        return null;
    }
}

export default { fetchQuote, fetchHistorical, fetchAssetProfile, fetchDividends };
