/**
 * Calculation Utilities for Financial and Technical Metrics
 * Pure functions for computing indicators used in Discovery Engine
 */

/**
 * Calculate RSI (Relative Strength Index)
 * @param prices Array of closing prices (oldest first)
 * @param period RSI period (typically 7 or 14)
 * @returns RSI value (0-100) or "N/A"
 */
export function calculateRSI(prices: number[], period: number): number | string {
    if (!prices || prices.length < period + 1) {
        return "N/A";
    }

    const gains: number[] = [];
    const losses: number[] = [];

    // Calculate price changes
    for (let i = 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? Math.abs(change) : 0);
    }

    // Calculate average gain and loss
    const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    return Math.round(rsi * 100) / 100;
}

/**
 * Calculate Simple Moving Average
 * @param prices Array of prices
 * @param period Period for SMA
 * @returns SMA value or "N/A"
 */
export function calculateSMA(prices: number[], period: number): number | string {
    if (!prices || prices.length < period) {
        return "N/A";
    }

    const relevantPrices = prices.slice(-period);
    const sum = relevantPrices.reduce((a, b) => a + b, 0);
    return Math.round((sum / period) * 100) / 100;
}

/**
 * Calculate annualized volatility
 * @param prices Array of closing prices
 * @returns Annualized volatility percentage or "N/A"
 */
export function calculateVolatility(prices: number[]): number | string {
    if (!prices || prices.length < 30) {
        return "N/A";
    }

    // Calculate daily returns
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    // Calculate standard deviation
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Annualize (252 trading days)
    const annualizedVol = stdDev * Math.sqrt(252) * 100;

    return Math.round(annualizedVol * 100) / 100;
}

/**
 * Calculate Sharpe Ratio
 * @param prices Array of closing prices
 * @param riskFreeRate Annual risk-free rate (default 4%)
 * @returns Sharpe ratio or "N/A"
 */
export function calculateSharpe(prices: number[], riskFreeRate: number = 0.04): number | string {
    if (!prices || prices.length < 30) {
        return "N/A";
    }

    // Calculate daily returns
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    // Mean return
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;

    // Annualize
    const annualReturn = meanReturn * 252;

    // Calculate volatility
    const volatility = calculateVolatility(prices);
    if (volatility === "N/A") return "N/A";

    const volDecimal = (volatility as number) / 100;

    // Sharpe = (Return - RiskFree) / Volatility
    const sharpe = (annualReturn - riskFreeRate) / volDecimal;

    return Math.round(sharpe * 100) / 100;
}

/**
 * Determine market trend based on price vs SMA
 * @param currentPrice Current price
 * @param sma50 50-day SMA
 * @returns Trend description
 */
export function getTrend(currentPrice: number, sma50: number | string): string {
    if (sma50 === "N/A" || !currentPrice) return "N/A";

    const diff = ((currentPrice - (sma50 as number)) / (sma50 as number)) * 100;

    if (diff > 5) return "Alcista";
    if (diff < -5) return "Bajista";
    return "Lateral";
}

/**
 * Calculate Altman Z-Score (simplified version)
 * @param fundamentals Object with financial data from Yahoo
 * @returns Z-Score or "N/A"
 */
export function calculateAltmanZScore(fundamentals: any): number | string {
    // Altman Z-Score requires:
    // X1 = Working Capital / Total Assets
    // X2 = Retained Earnings / Total Assets
    // X3 = EBIT / Total Assets
    // X4 = Market Cap / Total Liabilities
    // X5 = Sales / Total Assets
    // Z = 1.2*X1 + 1.4*X2 + 3.3*X3 + 0.6*X4 + 1.0*X5

    // Yahoo rarely provides all these values
    // Return "N/A" if essential data is missing
    if (!fundamentals?.totalAssets || !fundamentals?.marketCap) {
        return "N/A";
    }

    try {
        const totalAssets = fundamentals.totalAssets || 0;
        const workingCapital = (fundamentals.totalCurrentAssets || 0) - (fundamentals.totalCurrentLiabilities || 0);
        const retainedEarnings = fundamentals.retainedEarnings || 0;
        const ebit = fundamentals.ebit || 0;
        const marketCap = fundamentals.marketCap || 0;
        const totalLiabilities = fundamentals.totalLiab || 0;
        const revenue = fundamentals.totalRevenue || 0;

        if (totalAssets === 0 || totalLiabilities === 0) return "N/A";

        const x1 = workingCapital / totalAssets;
        const x2 = retainedEarnings / totalAssets;
        const x3 = ebit / totalAssets;
        const x4 = marketCap / totalLiabilities;
        const x5 = revenue / totalAssets;

        const zScore = 1.2 * x1 + 1.4 * x2 + 3.3 * x3 + 0.6 * x4 + 1.0 * x5;

        return Math.round(zScore * 100) / 100;
    } catch (e) {
        return "N/A";
    }
}

/**
 * Get risk zone based on Altman Z-Score
 * @param zScore Altman Z-Score
 * @returns Risk zone description
 */
export function getAltmanZone(zScore: number | string): string {
    if (zScore === "N/A") return "N/A";

    const z = zScore as number;
    if (z > 2.99) return "Zona Segura";
    if (z > 1.81) return "Zona Gris";
    return "Zona de Peligro";
}

/**
 * Get valuation state based on PE ratio
 * @param peRatio Price-to-Earnings ratio
 * @returns Valuation state
 */
export function getValuationState(peRatio: number | null): string {
    if (!peRatio || peRatio <= 0) return "Neutral";

    if (peRatio < 15) return "Infravalorado";
    if (peRatio > 25) return "Sobrevalorado";
    return "Neutral";
}

/**
 * Translate Yahoo recommendation key to Spanish
 * @param recommendationKey Yahoo's recommendation
 * @returns Spanish translation
 */
export function translateRecommendation(recommendationKey: string | undefined): string {
    if (!recommendationKey) return "N/A";

    const translations: Record<string, string> = {
        'strong_buy': 'Comprar Fuerte',
        'buy': 'Comprar',
        'hold': 'Mantener',
        'sell': 'Vender',
        'strong_sell': 'Vender Fuerte'
    };

    return translations[recommendationKey.toLowerCase()] || "N/A";
}
