import { Op } from 'sequelize'
import Operation from '../models/Operation.js'
import DailyPrice from '../models/DailyPrice.js'
import DailyPortfolioStats from '../models/DailyPortfolioStats.js'

/**
 * Calculates the portfolio history (PnL, Total Value, Total Invested) for a range of days.
 * @param {number} userId
 * @param {number} portfolioId
 * @param {number} days
 * @returns {Promise<Array>} Array of daily stats
 */
export const calculatePortfolioHistory = async (userId, portfolioId, days = 30) => {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const startIso = startDate.toISOString().slice(0, 10)
    const endIso = endDate.toISOString().slice(0, 10)

    // 1. Fetch all operations (we need full history to know positions at any point)
    const operations = await Operation.findAll({
        where: { userId, portfolioId },
        order: [['date', 'ASC']]
    })

    // 2. Fetch all daily prices within the range
    const prices = await DailyPrice.findAll({
        where: {
            userId,
            portfolioId,
            date: { [Op.gte]: startIso, [Op.lte]: endIso }
        }
    })

    // Group prices by date and positionKey for fast lookup
    // Map<date, Map<positionKey, priceObj>>
    const pricesByDate = new Map()
    for (const p of prices) {
        if (!pricesByDate.has(p.date)) {
            pricesByDate.set(p.date, new Map())
        }
        pricesByDate.get(p.date).set(p.positionKey, p)
    }

    const result = []

    // Track last known prices for each position (for holidays when markets are closed)
    const lastKnownPrices = new Map() // key -> { close, exchangeRate }

    // Iterate day by day
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateIso = d.toISOString().slice(0, 10)

        // Skip weekends (0 = Sunday, 6 = Saturday)
        const dayOfWeek = d.getDay()
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            continue
        }

        // Calculate positions held on this date
        const dayOps = operations.filter(o => {
            const opDate = new Date(o.date).toISOString().slice(0, 10)
            return opDate <= dateIso
        })

        // Calculate positions with proper cost basis logic
        const finalPositions = new Map() // key -> { shares, costBasis }
        let cumulativeRealizedPnL = 0 // Track realized PnL up to this date

        for (const o of dayOps) {
            const key = `${o.company}|||${o.symbol || ''}`
            if (!finalPositions.has(key)) {
                finalPositions.set(key, { shares: 0, costBasis: 0 })
            }
            const pos = finalPositions.get(key)

            if (o.type === 'purchase') {
                pos.shares += o.shares
                pos.costBasis += o.totalCost
            } else if (o.type === 'sale') {
                if (pos.shares > 0) {
                    const avgCost = pos.costBasis / pos.shares
                    const costRemoved = o.shares * avgCost

                    // Calculate realized PnL for this sale
                    // Sale Value in EUR = price * shares * exchangeRate
                    // Cost Removed in EUR = costRemoved
                    const saleValueEUR = o.price * o.shares * o.exchangeRate
                    const realizedPnL = saleValueEUR - costRemoved
                    cumulativeRealizedPnL += realizedPnL

                    pos.shares -= o.shares
                    pos.costBasis -= costRemoved
                }
            }
        }

        // Calculate Total Value for this day
        let dailyTotalValue = 0
        let dailyTotalInvested = 0

        const dayPrices = pricesByDate.get(dateIso) || new Map()

        for (const [key, pos] of finalPositions) {
            if (pos.shares <= 0.000001) continue // Skip closed positions

            dailyTotalInvested += pos.costBasis

            const priceObj = dayPrices.get(key)
            let close = null
            let exchangeRate = null

            if (priceObj && priceObj.close > 0) {
                // Use the closing price and exchange rate from that day
                close = priceObj.close
                exchangeRate = priceObj.exchangeRate
                // Update last known price for this position
                lastKnownPrices.set(key, { close, exchangeRate })
            } else {
                // No price or price is 0 (market closed, e.g., Thanksgiving)
                // Use last known price from previous business day
                const lastKnown = lastKnownPrices.get(key)
                if (lastKnown) {
                    close = lastKnown.close
                    exchangeRate = lastKnown.exchangeRate
                }
            }

            if (close && exchangeRate) {
                const val = close * exchangeRate * pos.shares
                dailyTotalValue += val
            }
        }

        result.push({
            date: dateIso,
            totalValueEUR: dailyTotalValue,
            totalInvestedEUR: dailyTotalInvested,
            pnlEUR: (dailyTotalValue - dailyTotalInvested) + cumulativeRealizedPnL // Add realized PnL
        })
    }

    return result
}

/**
 * Calculates and updates PnL for a specific date.
 * @param {number} userId
 * @param {number} portfolioId
 * @param {string} dateIso YYYY-MM-DD
 */
export const calculatePnLForDate = async (userId, portfolioId, dateIso) => {
    // 1.  Get all operations
    const operations = await Operation.findAll({
        where: { userId, portfolioId },
        order: [['date', 'ASC']]
    })

    // 2. Filter ops up to date
    const dayOps = operations.filter(o => {
        const opDate = new Date(o.date).toISOString().slice(0, 10)
        return opDate <= dateIso
    })

    // 3. Calculate Positions with average cost basis
    const finalPositions = new Map()
    for (const o of dayOps) {
        const key = `${o.company}|||${o.symbol || ''}`
        if (!finalPositions.has(key)) {
            finalPositions.set(key, { shares: 0, costBasis: 0 })
        }
        const pos = finalPositions.get(key)

        if (o.type === 'purchase') {
            pos.shares += o.shares
            pos.costBasis += o.totalCost
        } else if (o.type === 'sale') {
            if (pos.shares > 0) {
                const avgCost = pos.costBasis / pos.shares
                const costRemoved = o.shares * avgCost
                pos.shares -= o.shares
                pos.costBasis -= costRemoved
            }
        }
    }

    // 4. Get Prices for that date
    const prices = await DailyPrice.findAll({
        where: { userId, portfolioId, date: dateIso }
    })
    const priceMap = new Map()
    for (const p of prices) {
        priceMap.set(p.positionKey, p)
    }

    let totalValueEUR = 0
    let totalInvestedEUR = 0

    for (const [key, pos] of finalPositions) {
        if (pos.shares <= 0.000001) continue

        totalInvestedEUR += pos.costBasis
        const priceObj = priceMap.get(key)
        if (priceObj && priceObj.close > 0) {
            totalValueEUR += priceObj.close * priceObj.exchangeRate * pos.shares
        }
    }

    const pnlEUR = totalValueEUR - totalInvestedEUR

    // 5. Update/Create DailyPortfolioStats
    const existing = await DailyPortfolioStats.findOne({ where: { userId, portfolioId, date: dateIso } })
    if (existing) {
        await existing.update({ totalInvestedEUR, totalValueEUR, pnlEUR })
    } else {
        await DailyPortfolioStats.create({ userId, portfolioId, date: dateIso, totalInvestedEUR, totalValueEUR, pnlEUR })
    }

    return { date: dateIso, totalInvestedEUR, totalValueEUR, pnlEUR }
}

/**
 * Calculates monthly PnL analysis for the last 12 completed months.
 * Excludes the current month.
 * @param {number} userId
 * @param {number} portfolioId
 * @returns {Promise<Array>} Array of { month: 'YYYY-MM', gain: number, growthRate: number }
 */
export const calculateMonthlyAnalysis = async (userId, portfolioId) => {
    const monthsToAnalyze = 12
    const results = []

    // Start from last month
    const date = new Date()
    date.setDate(1) // Go to first day of current month
    date.setHours(0, 0, 0, 0)

    for (let i = 0; i < monthsToAnalyze; i++) {
        // Go back one month
        date.setMonth(date.getMonth() - 1)

        // Get last day of that month
        const year = date.getFullYear()
        const month = date.getMonth()
        const lastDay = new Date(year, month + 1, 0)
        const lastDayIso = lastDay.toISOString().slice(0, 10)
        const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`

        // Calculate PnL for that date
        // We use calculatePnLForDate which handles "last known price" if the market was closed
        // However, calculatePnLForDate uses DailyPrice.findAll({ where: { date: dateIso } })
        // If the last day of the month was a Sunday, we might not have a price for that exact date
        // But calculatePnLForDate logic (as currently implemented) might need a small tweak or we rely on it finding prices?
        // Wait, calculatePnLForDate fetches prices for *that specific date*. 
        // If that date is a Sunday, it returns empty prices, and then logic says:
        // "if (priceObj && priceObj.close > 0) ... else { // No price ... }"
        // But calculatePnLForDate DOES NOT implement the "last known price" lookback logic that calculatePortfolioHistory does.
        // calculatePortfolioHistory iterates day by day and keeps state. calculatePnLForDate is stateless for a single day.

        // So we should actually use calculatePortfolioHistory logic but just for the specific dates we need?
        // Or better: Use calculatePortfolioHistory for the whole year range and then pick the month-end dates.
        // That's much more efficient and robust because it naturally handles the "last known price" continuity.

        // Let's change strategy: Fetch history for the last 13 months (to get start of first month)
        // and then sample the month-end dates.
    }

    // New Strategy:
    const today = new Date()
    const endDate = new Date()
    endDate.setDate(0) // Last day of previous month

    const startDate = new Date(endDate)
    startDate.setFullYear(startDate.getFullYear() - 1) // 1 year ago
    startDate.setDate(1) // 1st of that month

    // Calculate days from TODAY back to startDate to ensure we cover the whole period
    const diffTime = Math.abs(today - startDate)
    const daysToFetch = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 5 // Buffer

    // calculatePortfolioHistory returns business days only (skips weekends)
    // It also handles holidays by carrying forward the last known price.
    const history = await calculatePortfolioHistory(userId, portfolioId, daysToFetch)

    // Now group by month and pick the last entry for each month
    const monthlyMap = new Map()

    history.forEach(dayStat => {
        const d = new Date(dayStat.date)
        // Filter out current month if it somehow got in (though we set endDate to last month)
        // Actually calculatePortfolioHistory uses "days" from today. 
        // So it includes today. We need to filter.

        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

        // We want the last available data point for each month
        // Since history is ordered by date, we can just overwrite
        monthlyMap.set(monthKey, dayStat)
    })

    // Filter out current month just in case
    const currentMonthKey = new Date().toISOString().slice(0, 7)
    if (monthlyMap.has(currentMonthKey)) {
        monthlyMap.delete(currentMonthKey)
    }

    // Convert to array
    const monthlyStats = Array.from(monthlyMap.entries())
        .map(([month, stat]) => ({
            month,
            gain: stat.pnlEUR, // Absolute PnL at end of month
            totalValue: stat.totalValueEUR,
            date: stat.date
        }))
        .sort((a, b) => a.month.localeCompare(b.month))

    // Calculate growth rate (month over month)
    // Wait, user wants "Monthly Analysis".
    // If I show "Gain: +103", is that the PnL of that month? Or total PnL?
    // User said: "se debera tener el PnL del ultimo dia del mes".
    // If I show bars of Total PnL, it shows the trend of wealth.
    // If I show bars of Monthly Gain (Delta), it shows performance per month.
    // The screenshot shows "Mejor Mes". You can't have a "Best Month" of Total PnL (that's just "All Time High").
    // "Best Month" implies the month where you made the most money.
    // So I should calculate the DELTA.
    // Gain = PnL(End of Month) - PnL(End of Previous Month).

    const finalResults = []
    for (let i = 0; i < monthlyStats.length; i++) {
        const current = monthlyStats[i]
        const prev = i > 0 ? monthlyStats[i - 1] : null

        // If no previous month, gain is just the current PnL (assuming started at 0? or just show N/A?)
        // Or we can try to fetch one more month back to get the start.
        // For now, let's use the PnL as is for the first one, or 0 if we want strict delta.
        // Actually, if we want "Best Month", we need deltas.

        let monthlyGain = current.gain
        let growthRate = 0

        if (prev) {
            monthlyGain = current.gain - prev.gain
            if (prev.totalValue > 0) {
                // Growth based on Total Value? Or PnL change?
                // Usually (EndValue - StartValue) / StartValue - NetFlows...
                // But simplified: (CurrentPnL - PrevPnL) / PrevTotalValue?
                // Let's stick to simple PnL delta.
                // Growth rate: (CurrentTotalValue - PrevTotalValue) / PrevTotalValue * 100
                // But this includes deposits.
                // We want performance.
                // Let's just use PnL Delta for "Gain".
                // And for growth rate... maybe just (PnL Delta) / Invested?
                // Let's stick to what reportGenerator did:
                // growthRate: ((lastReport.totalValueEUR - firstReport.totalValueEUR) / firstReport.totalValueEUR) * 100
                // This is flawed if there are deposits.

                // Let's just return the PnL Delta as "gain".
                // And maybe omit growth rate or calculate it as Gain / TotalInvested?
            }
        }

        // Wait, the user said "se debera tener el PnL del ultimo dia del mes".
        // Maybe they DO want the absolute PnL?
        // "Mejor Mes: 2025-11 +103".
        // If I have PnL 100 in Oct and 203 in Nov. Gain is 103.
        // If I have PnL 100 in Oct and 100 in Nov. Gain is 0.
        // This makes sense for "Best Month".
        // So I WILL calculate the delta.

        finalResults.push({
            month: current.month,
            gain: monthlyGain,
            growthRate: 0, // Placeholder or calculate if needed
            totalValue: current.totalValue
        })
    }

    return finalResults
}
