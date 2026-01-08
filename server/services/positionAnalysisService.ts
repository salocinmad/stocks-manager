/**
 * Position Analysis Service v2.1.0
 * 
 * Calculates risk metrics, technical indicators, and simulation scenarios
 * for individual portfolio positions.
 */

import sql from '../db';
import { MarketDataService, FundamentalData, CompanyEvent } from './marketData';

// Interfaces
export interface SolvencyRisk {
    zScore: number;                    // Altman Z-Score value
    zone: 'SAFE' | 'GREY' | 'DISTRESS'; // Risk zone
    label: string;                     // Human-readable label
}

export interface RiskMetrics {
    volatility: number;        // Annualized volatility
    sharpe: number;            // Sharpe Ratio
    sortino: number;           // Sortino Ratio
    maxDrawdown: number;       // Maximum Drawdown %
    beta: number;              // Beta vs S&P500
    var95: number;             // Value at Risk 95%
    score: number;             // Risk Score 1-10 (Price Risk)
    solvency: SolvencyRisk | null; // Altman Z-Score based solvency risk
}

export interface TechnicalIndicators {
    rsi: number | null;
    sma50: number | null;
    sma200: number | null;
    trend: string;
}

export interface SimulationResult {
    newAveragePrice: number;
    newQuantity: number;
    newTotalValue: number;
    newWeight: number;
    projectedPnL: number;
    projectedPnLPercent: number;
}

export interface AnalystData {
    consensus: string | null;
    targetPrice: number | null;
    currentPrice: number;
    targetUpside: string | null;
    numberOfAnalysts: number | null;
    breakdown: {
        strongBuy: number;
        buy: number;
        hold: number;
        sell: number;
        strongSell: number;
    } | null;
    insiderSentiment: {
        mspr: number;
        label: string;
    } | null;
}

export interface TickerAnalysis {
    ticker: string;
    currentPrice: number;
    currency: string;
    technical: TechnicalIndicators;
    risk: RiskMetrics;
    analysts: AnalystData;
    fundamentals: FundamentalData | null;
    sector: string;
    industry: string;
    calendarEvents: CompanyEvent[];
    calculatedAt: string;
    // V10 data sections
    governance?: any;
    dividends?: any;
    calendar?: any;
    earnings?: any;
    financialHealth?: any;
    valuation?: any;
    extended?: any;
}

export interface PositionAnalysis extends TickerAnalysis {
    // Position data
    positionId: string;
    quantity: number;
    averagePrice: number;
    totalValue: number;
    costBasis: number;
    pnl: number;
    pnlPercent: number;
    weight: number;
}


// Risk-free rate for Sharpe/Sortino (approx. 3-month T-bill)
const RISK_FREE_RATE = 0.05; // 5% annual

export const PositionAnalysisService = {
    /**
     * Calculate daily returns from prices
     */
    calculateReturns(prices: number[]): number[] {
        const returns: number[] = [];
        for (let i = 1; i < prices.length; i++) {
            if (prices[i - 1] !== 0) {
                returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
            }
        }
        return returns;
    },

    /**
     * Annualized Volatility (Standard Deviation of Returns × √252)
     */
    calculateVolatility(returns: number[]): number {
        if (returns.length < 2) return 0;

        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / (returns.length - 1);
        const dailyStd = Math.sqrt(variance);

        // Annualize: multiply by sqrt(252 trading days)
        return dailyStd * Math.sqrt(252) * 100; // Return as percentage
    },

    /**
     * Sharpe Ratio: (Return - RiskFreeRate) / Volatility
     */
    calculateSharpeRatio(returns: number[]): number {
        if (returns.length < 2) return 0;

        // Annualized return
        const meanDailyReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const annualizedReturn = meanDailyReturn * 252;

        // Annualized volatility
        const volatility = this.calculateVolatility(returns) / 100;

        if (volatility === 0) return 0;

        return (annualizedReturn - RISK_FREE_RATE) / volatility;
    },

    /**
     * Sortino Ratio: Only considers downside volatility
     */
    calculateSortinoRatio(returns: number[]): number {
        if (returns.length < 2) return 0;

        const meanDailyReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const annualizedReturn = meanDailyReturn * 252;

        // Downside deviation (only negative returns)
        const negativeReturns = returns.filter(r => r < 0);
        if (negativeReturns.length === 0) return 3; // Very good - no negative days

        const downsideVariance = negativeReturns.reduce((a, r) => a + r * r, 0) / negativeReturns.length;
        const downsideDeviation = Math.sqrt(downsideVariance) * Math.sqrt(252);

        if (downsideDeviation === 0) return 0;

        return (annualizedReturn - RISK_FREE_RATE) / downsideDeviation;
    },

    /**
     * Maximum Drawdown: Largest peak-to-trough decline
     */
    calculateMaxDrawdown(prices: number[]): { value: number; peakIdx: number; troughIdx: number } {
        if (prices.length < 2) return { value: 0, peakIdx: 0, troughIdx: 0 };

        let maxDrawdown = 0;
        let peak = prices[0];
        let peakIdx = 0;
        let maxPeakIdx = 0;
        let maxTroughIdx = 0;

        for (let i = 1; i < prices.length; i++) {
            if (prices[i] > peak) {
                peak = prices[i];
                peakIdx = i;
            }

            const drawdown = (peak - prices[i]) / peak;

            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
                maxPeakIdx = peakIdx;
                maxTroughIdx = i;
            }
        }

        return {
            value: maxDrawdown * 100, // As percentage
            peakIdx: maxPeakIdx,
            troughIdx: maxTroughIdx
        };
    },

    /**
     * Beta: Correlation with S&P500
     */
    calculateBeta(tickerReturns: number[], benchmarkReturns: number[]): number {
        if (tickerReturns.length !== benchmarkReturns.length || tickerReturns.length < 2) {
            return 1; // Default to market beta
        }

        const n = tickerReturns.length;
        const meanTicker = tickerReturns.reduce((a, b) => a + b, 0) / n;
        const meanBenchmark = benchmarkReturns.reduce((a, b) => a + b, 0) / n;

        let covariance = 0;
        let benchmarkVariance = 0;

        for (let i = 0; i < n; i++) {
            covariance += (tickerReturns[i] - meanTicker) * (benchmarkReturns[i] - meanBenchmark);
            benchmarkVariance += Math.pow(benchmarkReturns[i] - meanBenchmark, 2);
        }

        if (benchmarkVariance === 0) return 1;

        return covariance / benchmarkVariance;
    },

    /**
     * Value at Risk (95% confidence)
     * Parametric VaR using normal distribution
     */
    calculateVaR95(returns: number[]): number {
        if (returns.length < 2) return 0;

        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / (returns.length - 1);
        const std = Math.sqrt(variance);

        // 95% confidence = 1.645 standard deviations
        const var95 = mean - (1.645 * std);

        return var95 * 100; // As percentage
    },

    /**
     * Altman Z-Score: Predicts bankruptcy risk
     * Formula: Z = 1.2*A + 1.4*B + 3.3*C + 0.6*D + 1.0*E
     * Where:
     * A = Working Capital / Total Assets
     * B = Retained Earnings / Total Assets
     * C = EBIT / Total Assets
     * D = Market Cap / Total Liabilities
     * E = Revenue / Total Assets
     */
    calculateAltmanZ(fundamentals: FundamentalData | null, marketCap: number): SolvencyRisk | null {
        if (!fundamentals) return null;

        const f = fundamentals;
        // Estimate required values from available data
        // We approximate with available metrics since Yahoo doesn't expose all fields directly
        const totalAssets = f.enterpriseValue ? f.enterpriseValue - f.totalDebt + f.totalCash : 0;
        if (totalAssets <= 0) return null;

        const workingCapital = f.totalCash - (f.totalDebt * 0.2); // Approximate current portion of debt
        const retainedEarnings = f.bookValue * 0.5; // Rough estimate (part of book value)
        const ebit = f.ebitda ? f.ebitda * 0.85 : 0; // Approximate EBIT from EBITDA
        const totalLiabilities = f.totalDebt;

        if (totalLiabilities <= 0) {
            // No debt = very safe
            return { zScore: 10, zone: 'SAFE', label: 'Muy Seguro (Sin Deuda)' };
        }

        // Calculate Z-Score components
        const A = workingCapital / totalAssets;
        const B = retainedEarnings / totalAssets;
        const C = ebit / totalAssets;
        const D = marketCap / totalLiabilities;
        const E = f.totalRevenue / totalAssets;

        const zScore = (1.2 * A) + (1.4 * B) + (3.3 * C) + (0.6 * D) + (1.0 * E);

        let zone: 'SAFE' | 'GREY' | 'DISTRESS';
        let label: string;

        if (zScore >= 3.0) {
            zone = 'SAFE';
            label = 'Zona Segura';
        } else if (zScore >= 1.8) {
            zone = 'GREY';
            label = 'Zona Gris (Precaución)';
        } else {
            zone = 'DISTRESS';
            label = 'Zona de Peligro';
        }

        return { zScore: parseFloat(zScore.toFixed(2)), zone, label };
    },

    /**
     * Smart Risk Score (1-10) with Quality Bonuses
     * Combines volatility-based risk with fundamental quality factors
     */
    calculateRiskScore(metrics: RiskMetrics, fundamentals?: FundamentalData | null, analystConsensus?: string | null, targetUpside?: string | null): number {
        let score = 5; // Start at neutral

        // Volatility contribution (higher = more risk)
        if (metrics.volatility > 40) score += 2;
        else if (metrics.volatility > 25) score += 1;
        else if (metrics.volatility < 15) score -= 1;

        // Max Drawdown contribution
        if (metrics.maxDrawdown > 30) score += 2;
        else if (metrics.maxDrawdown > 20) score += 1;
        else if (metrics.maxDrawdown < 10) score -= 1;

        // Beta contribution
        if (metrics.beta > 1.5) score += 1;
        else if (metrics.beta < 0.5) score -= 1;

        // Sharpe contribution (higher = better = less risk perception)
        if (metrics.sharpe < 0) score += 1;
        else if (metrics.sharpe > 1.5) score -= 1;

        // === QUALITY BONUSES ===
        if (fundamentals) {
            // 1. Size Factor: Mega-Cap companies are more stable
            const marketCap = fundamentals.marketCap || 0;
            if (marketCap >= 200e9) {
                score -= 2; // Mega-Cap (>$200B)
            } else if (marketCap >= 10e9) {
                score -= 1; // Large-Cap (>$10B)
            }

            // 2. Profitability Factor: Profitable = less risk (relaxed to PE < 200)
            if (fundamentals.trailingPE > 0 && fundamentals.trailingPE < 200) {
                score -= 1; // Has real earnings
            }

            // 3. Net Cash Position: No debt pressure = safer
            // netDebt = totalDebt - totalCash; negative means company has more cash than debt
            const netDebt = (fundamentals.totalDebt || 0) - (fundamentals.totalCash || 0);
            if (netDebt < 0) {
                score -= 1; // Net cash position (like AMD: -3.37B)
            }

            // 4. Free Cash Flow: Generates real cash
            if (fundamentals.freeCashflow > 0) {
                score -= 1; // Positive FCF
            }

            // 5. Revenue Growth: Growing companies are healthier
            if (fundamentals.revenueGrowth !== undefined && fundamentals.revenueGrowth > 0.15) {
                score -= 1; // >15% YoY revenue growth
            }
        }

        // 6. Analyst Consensus Factor
        if (analystConsensus) {
            const consensus = analystConsensus.toLowerCase();
            if (consensus.includes('buy') || consensus.includes('strong')) {
                score -= 1; // Market confidence
            }
        }

        // 7. Undervalued Factor (Price < Target)
        if (targetUpside) {
            const upside = parseFloat(targetUpside);
            if (upside > 10) {
                score -= 1; // Significant margin of safety
            }
        }

        // Clamp to 1-10
        return Math.max(1, Math.min(10, Math.round(score)));
    },

    /**
     * Calculate all risk metrics for a position
     */
    async calculateRiskMetrics(ticker: string): Promise<RiskMetrics> {
        try {
            // Get 1 year of history
            const history = await MarketDataService.getDetailedHistory(ticker, 1);
            if (history.length < 30) {
                return { volatility: 0, sharpe: 0, sortino: 0, maxDrawdown: 0, beta: 1, var95: 0, score: 5, solvency: null };
            }

            const prices = history.map((h: any) => Number(h.close));
            const returns = this.calculateReturns(prices);

            // Get S&P500 for beta calculation
            let benchmarkReturns: number[] = [];
            try {
                const sp500History = await MarketDataService.getDetailedHistory('^GSPC', 1);
                if (sp500History.length >= 30) {
                    const sp500Prices = sp500History.map((h: any) => Number(h.close));
                    benchmarkReturns = this.calculateReturns(sp500Prices);
                    // Align lengths
                    const minLen = Math.min(returns.length, benchmarkReturns.length);
                    benchmarkReturns = benchmarkReturns.slice(-minLen);
                }
            } catch (e) {
                console.warn('Could not fetch S&P500 for beta calculation');
            }

            const volatility = this.calculateVolatility(returns);
            const sharpe = this.calculateSharpeRatio(returns);
            const sortino = this.calculateSortinoRatio(returns);
            const maxDrawdownResult = this.calculateMaxDrawdown(prices);
            const beta = benchmarkReturns.length > 0
                ? this.calculateBeta(returns.slice(-benchmarkReturns.length), benchmarkReturns)
                : 1;
            const var95 = this.calculateVaR95(returns);

            const metrics: RiskMetrics = {
                volatility: parseFloat(volatility.toFixed(2)),
                sharpe: parseFloat(sharpe.toFixed(2)),
                sortino: parseFloat(sortino.toFixed(2)),
                maxDrawdown: parseFloat(maxDrawdownResult.value.toFixed(2)),
                beta: parseFloat(beta.toFixed(2)),
                var95: parseFloat(var95.toFixed(2)),
                score: 0,
                solvency: null
            };

            metrics.score = this.calculateRiskScore(metrics);

            return metrics;
        } catch (e) {
            console.error('Error calculating risk metrics:', e);
            return { volatility: 0, sharpe: 0, sortino: 0, maxDrawdown: 0, beta: 1, var95: 0, score: 5, solvency: null };
        }
    },

    /**
     * Simulate buying more shares
     */
    simulateBuy(
        currentQty: number,
        currentAvgPrice: number,
        additionalQty: number,
        buyPrice: number,
        portfolioTotalValue: number
    ): SimulationResult {
        const newQuantity = currentQty + additionalQty;
        const currentCost = currentQty * currentAvgPrice;
        const additionalCost = additionalQty * buyPrice;
        const newAveragePrice = (currentCost + additionalCost) / newQuantity;
        const newTotalValue = newQuantity * buyPrice;
        const costBasis = newQuantity * newAveragePrice;
        const projectedPnL = newTotalValue - costBasis;
        const projectedPnLPercent = costBasis > 0 ? (projectedPnL / costBasis) * 100 : 0;
        const newWeight = portfolioTotalValue > 0 ? (newTotalValue / portfolioTotalValue) * 100 : 0;

        return {
            newAveragePrice: parseFloat(newAveragePrice.toFixed(4)),
            newQuantity,
            newTotalValue: parseFloat(newTotalValue.toFixed(2)),
            newWeight: parseFloat(newWeight.toFixed(2)),
            projectedPnL: parseFloat(projectedPnL.toFixed(2)),
            projectedPnLPercent: parseFloat(projectedPnLPercent.toFixed(2))
        };
    },

    /**
     * Simulate selling shares
     */
    simulateSell(
        currentQty: number,
        currentAvgPrice: number,
        sellQty: number,
        currentPrice: number,
        portfolioTotalValue: number
    ): SimulationResult {
        const newQuantity = Math.max(0, currentQty - sellQty);
        const newAveragePrice = currentAvgPrice; // Average doesn't change on sell
        const newTotalValue = newQuantity * currentPrice;
        const costBasis = newQuantity * newAveragePrice;
        const projectedPnL = newTotalValue - costBasis;
        const projectedPnLPercent = costBasis > 0 ? (projectedPnL / costBasis) * 100 : 0;
        const newWeight = portfolioTotalValue > 0 ? (newTotalValue / portfolioTotalValue) * 100 : 0;

        // Realized PnL from the sale
        const realizedPnL = sellQty * (currentPrice - currentAvgPrice);

        return {
            newAveragePrice: parseFloat(newAveragePrice.toFixed(4)),
            newQuantity,
            newTotalValue: parseFloat(newTotalValue.toFixed(2)),
            newWeight: parseFloat(newWeight.toFixed(2)),
            projectedPnL: parseFloat(realizedPnL.toFixed(2)), // Return realized PnL
            projectedPnLPercent: parseFloat(((realizedPnL / (sellQty * currentAvgPrice)) * 100).toFixed(2))
        };
    },

    /**
     * Simulate price change
     */
    simulatePriceChange(
        currentQty: number,
        currentAvgPrice: number,
        currentPrice: number,
        percentChange: number,
        portfolioTotalValue: number
    ): SimulationResult {
        const newPrice = currentPrice * (1 + percentChange / 100);
        const newTotalValue = currentQty * newPrice;
        const costBasis = currentQty * currentAvgPrice;
        const projectedPnL = newTotalValue - costBasis;
        const projectedPnLPercent = costBasis > 0 ? (projectedPnL / costBasis) * 100 : 0;
        const newWeight = portfolioTotalValue > 0 ? (newTotalValue / portfolioTotalValue) * 100 : 0;

        return {
            newAveragePrice: currentAvgPrice,
            newQuantity: currentQty,
            newTotalValue: parseFloat(newTotalValue.toFixed(2)),
            newWeight: parseFloat(newWeight.toFixed(2)),
            projectedPnL: parseFloat(projectedPnL.toFixed(2)),
            projectedPnLPercent: parseFloat(projectedPnLPercent.toFixed(2))
        };
    },

    /**
     * Get analyst recommendations data
     */
    async getAnalystData(ticker: string, currency?: string): Promise<AnalystData> {
        try {
            // Parallel requests for efficiency
            const [quote, finnhubRec, insiderSentiment] = await Promise.all([
                MarketDataService.getQuote(ticker),
                MarketDataService.getAnalystRecommendations(ticker, currency),
                MarketDataService.getInsiderSentiment(ticker, currency)
            ]);

            const currentPrice = quote?.c || 0;
            const targetPrice = quote?.targetMeanPrice ? parseFloat(quote.targetMeanPrice) : null;
            const targetUpside = targetPrice && currentPrice > 0
                ? (((targetPrice - currentPrice) / currentPrice) * 100).toFixed(1)
                : null;

            return {
                consensus: quote?.recommendationKey || null,
                targetPrice,
                currentPrice,
                targetUpside,
                numberOfAnalysts: finnhubRec ?
                    (finnhubRec.strongBuy + finnhubRec.buy + finnhubRec.hold + finnhubRec.sell + finnhubRec.strongSell) : null,
                breakdown: finnhubRec || null,
                insiderSentiment: insiderSentiment || null
            };
        } catch (e) {
            console.error('Error fetching analyst data:', e);
            return {
                consensus: null,
                targetPrice: null,
                currentPrice: 0,
                targetUpside: null,
                numberOfAnalysts: null,
                breakdown: null,
                insiderSentiment: null
            };
        }
    },

    /**
     * Get market analysis for a ticker (reusable for positions & discovery)
     */
    async getTickerAnalysis(ticker: string, forceRefresh = false): Promise<TickerAnalysis | null> {
        try {
            const cacheKey = `analysis:${ticker.toUpperCase()}`;
            const SIX_HOURS = 6 * 60 * 60 * 1000;

            if (!forceRefresh) {
                const cached = await sql`
                    SELECT data FROM market_cache 
                    WHERE key = ${cacheKey} AND expires_at > NOW()
                `;
                if (cached.length > 0) {
                    return cached[0].data as TickerAnalysis;
                }
            }

            // Calculate fresh
            const quote = await MarketDataService.getQuote(ticker);
            if (!quote) return null;

            const history = await MarketDataService.getDetailedHistory(ticker, 1);
            const prices = history.map((h: any) => Number(h.close));

            const techResult = MarketDataService.getTechnicalIndicators(prices);
            const technical = techResult || { rsi: null, sma50: null, sma200: null, trend: 'NEUTRAL' };
            const risk = await this.calculateRiskMetrics(ticker);
            const analysts = await this.getAnalystData(ticker, quote.currency);
            const fundamentals = await MarketDataService.getFundamentals(ticker);
            const calendarEvents = await MarketDataService.getCalendarEvents(ticker);
            const profile = await MarketDataService.getAssetProfile(ticker);

            // RECALCULATE RISK SCORE with Quality Bonuses
            risk.score = this.calculateRiskScore(risk, fundamentals, analysts.consensus, analysts.targetUpside);
            risk.solvency = this.calculateAltmanZ(fundamentals, fundamentals?.marketCap || 0);

            // NEW: Fetch V10 enhanced data for additional sections
            let v10Data: any = null;
            try {
                v10Data = await MarketDataService.getEnhancedQuoteData(ticker);
            } catch (v10Err) {
                console.warn(`[PositionAnalysisService] Could not fetch V10 data for ${ticker}:`, v10Err);
            }

            const analysis: TickerAnalysis = {
                ticker,
                currentPrice: quote.c,
                currency: quote.currency || 'USD',
                technical,
                risk,
                analysts,
                fundamentals,
                sector: profile.sector,
                industry: profile.industry,
                calendarEvents,
                calculatedAt: new Date().toISOString(),
                // V10 DATA SECTIONS (from getEnhancedQuoteData)
                governance: v10Data?.governance || null,
                dividends: v10Data?.dividends || null,
                calendar: v10Data?.calendar || null,
                earnings: v10Data?.earnings || null,
                financialHealth: v10Data?.financialHealth || null,
                valuation: v10Data?.valuation || null,
                extended: v10Data?.extended || null,
            };

            // Save to market_cache
            const expiresAt = new Date(Date.now() + SIX_HOURS);
            await sql`
                INSERT INTO market_cache (key, data, expires_at)
                VALUES (${cacheKey}, ${analysis as any}, ${expiresAt})
                ON CONFLICT (key) DO UPDATE 
                SET data = EXCLUDED.data, expires_at = EXCLUDED.expires_at, created_at = NOW()
            `;

            return analysis;
        } catch (e) {
            console.error('Error getting ticker analysis:', e);
            return null;
        }
    },

    /**
     * Save analysis results to the position_analysis_cache table
     */
    async saveToCache(
        positionId: string,
        ticker: string,
        technical: { rsi: number | null; sma50: number | null; sma200: number | null; trend: string },
        risk: { volatility: number; sharpe: number; sortino: number; maxDrawdown: number; beta: number; var95: number; score: number }
    ): Promise<void> {
        try {
            await sql`
                INSERT INTO position_analysis_cache (
                    position_id, ticker, rsi, sma_50, sma_200, trend,
                    volatility, sharpe_ratio, sortino_ratio, max_drawdown, beta, var_95, risk_score,
                    calculated_at
                ) VALUES (
                    ${positionId}, ${ticker}, 
                    ${technical.rsi}, ${technical.sma50}, ${technical.sma200}, ${technical.trend},
                    ${risk.volatility}, ${risk.sharpe}, ${risk.sortino}, ${risk.maxDrawdown}, 
                    ${risk.beta}, ${risk.var95}, ${risk.score},
                    NOW()
                )
                ON CONFLICT (position_id) DO UPDATE SET
                    ticker = EXCLUDED.ticker,
                    rsi = EXCLUDED.rsi,
                    sma_50 = EXCLUDED.sma_50,
                    sma_200 = EXCLUDED.sma_200,
                    trend = EXCLUDED.trend,
                    volatility = EXCLUDED.volatility,
                    sharpe_ratio = EXCLUDED.sharpe_ratio,
                    sortino_ratio = EXCLUDED.sortino_ratio,
                    max_drawdown = EXCLUDED.max_drawdown,
                    beta = EXCLUDED.beta,
                    var_95 = EXCLUDED.var_95,
                    risk_score = EXCLUDED.risk_score,
                    calculated_at = NOW()
            `;
        } catch (e) {
            console.error(`[PositionAnalysisService] Error saving cache for ${ticker}:`, e);
            throw e;
        }
    },

    /**
     * Get full analysis for a position
     */
    async getFullAnalysis(positionId: string, portfolioId: string): Promise<PositionAnalysis | null> {
        try {
            // 1. Get position data
            const positions = await sql`
                SELECT p.*, 
                       (SELECT SUM(pos.quantity * COALESCE(
                           (SELECT (data->>'c')::decimal FROM market_cache mc 
                            WHERE mc.key = 'quote:' || pos.ticker 
                            LIMIT 1), 0))
                        FROM positions pos 
                        WHERE pos.portfolio_id = ${portfolioId}
                       ) as portfolio_total_value
                FROM positions p
                WHERE p.id = ${positionId}
            `;

            if (positions.length === 0) return null;

            const position = positions[0];
            const ticker = position.ticker;

            // 2. Get Ticker Analysis
            const tickerAnalysis = await this.getTickerAnalysis(ticker);
            if (!tickerAnalysis) return null;

            const currentPrice = tickerAnalysis.currentPrice;
            const quantity = Number(position.quantity);
            const avgPrice = Number(position.average_buy_price);
            const totalValue = quantity * currentPrice;
            const costBasis = quantity * avgPrice;
            const pnl = totalValue - costBasis;
            const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
            const portfolioValue = Number(position.portfolio_total_value) || totalValue;
            const weight = portfolioValue > 0 ? (totalValue / portfolioValue) * 100 : 0;

            return {
                ...tickerAnalysis,
                positionId,
                quantity,
                averagePrice: avgPrice,
                totalValue: parseFloat(totalValue.toFixed(2)),
                costBasis: parseFloat(costBasis.toFixed(2)),
                pnl: parseFloat(pnl.toFixed(2)),
                pnlPercent: parseFloat(pnlPercent.toFixed(2)),
                weight: parseFloat(weight.toFixed(2))
            };
        } catch (e) {
            console.error('Error getting full position analysis:', e);
            return null;
        }
    }
};
