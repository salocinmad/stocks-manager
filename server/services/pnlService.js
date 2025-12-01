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
            pnlEUR: dailyTotalValue - dailyTotalInvested
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
