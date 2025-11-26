import Config from '../models/Config.js'
import Operation from '../models/Operation.js'
import Portfolio from '../models/Portfolio.js'
import DailyPrice from '../models/DailyPrice.js'
import yahooFinance from 'yahoo-finance2';

let dailyTimer = null
let dailyRunning = false

import DailyPortfolioStats from '../models/DailyPortfolioStats.js'

const getConfig = async () => {
  const enabledRow = await Config.findOne({ where: { key: 'daily_close_enabled' } })
  const timeRow = await Config.findOne({ where: { key: 'daily_close_time' } })
  const enabled = enabledRow ? enabledRow.value === 'true' : true
  // Default to 01:00 if not set
  const timeStr = timeRow?.value || '01:00'

  // If time config doesn't exist, create it with default 01:00
  if (!timeRow) {
    await Config.create({ key: 'daily_close_time', value: '01:00' })
  }

  return { enabled, timeStr }
}

const setLastRun = async (iso) => {
  const key = 'daily_close_last_run'
  const val = iso || new Date().toISOString()
  const [row, created] = await Config.findOrCreate({ where: { key }, defaults: { value: val } })
  if (!created) { row.value = val; await row.save() }
}

const getPreviousBusinessDate = async () => {
  // Usar calendario de Madrid independientemente del TZ de sistema
  const nowMadrid = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
  const d = new Date(nowMadrid)
  d.setDate(d.getDate() - 1)
  const day = d.getDay() // 0 domingo, 6 sábado (calculado sobre Madrid)
  if (day === 0) { // domingo → viernes
    d.setDate(d.getDate() - 2)
  } else if (day === 6) { // sábado → viernes
    d.setDate(d.getDate() - 1)
  }
  const isoMadrid = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  return isoMadrid // YYYY-MM-DD en huso Madrid
}

const fetchPreviousClose = async (symbol) => {
  try {
    if (!symbol) return null
    const ySymbol = String(symbol).replace(/[:\-]/g, '.')
    const q = await yahooFinance.quote(ySymbol)
    let close = q?.regularMarketPreviousClose || q?.regularMarketPrice || null
    if (!close || close <= 0) {
      const chart = await yahooFinance.chart(symbol, { period1: '7d', interval: '1d' })
      const arr = chart?.quotes || []
      if (arr.length > 0) {
        const last = arr[arr.length - 1]
        close = last?.close || close
      }
    }
    if (!close || close <= 0) return null
    return { close, currency: q?.currency || 'EUR', source: 'yahoo' }
  } catch {
    return null
  }
}

export const runDailyOnce = async () => {
  if (dailyRunning) return { ok: false, reason: 'already_running' }
  dailyRunning = true
  try {
    const date = await getPreviousBusinessDate()
    const fxMap = await getFxMapToEUR()
    const users = await Operation.findAll({ attributes: ['userId'], group: ['userId'] })
    let processed = 0
    let failures = []
    for (const u of users) {
      const userId = u.userId

      const portfolios = await Portfolio.findAll({ where: { userId } })
      for (const pf of portfolios) {
        const portfolioId = pf.id

      // 1. Calculate Active Positions and Total Cost (Invested Capital)
      const ops = await Operation.findAll({ where: { userId, portfolioId } })
      const positionsMap = new Map()

      for (const o of ops) {
        const key = `${o.company}|||${o.symbol || ''}`
        const prev = positionsMap.get(key) || {
          company: o.company,
          symbol: o.symbol || '',
          shares: 0,
          totalCost: 0
        }

        if (o.type === 'purchase') {
          prev.shares += o.shares
          prev.totalCost += parseFloat(o.totalCost)
        } else if (o.type === 'sale') {
          prev.shares -= o.shares
          prev.totalCost -= parseFloat(o.totalCost)
        }

        positionsMap.set(key, prev)
      }

      const activePositions = Array.from(positionsMap.values()).filter(p => p.shares > 0)
      const totalInvestedEUR = activePositions.reduce((sum, p) => sum + p.totalCost, 0)

      // 2. Fetch/Update Daily Prices and Calculate Total Market Value
      let totalValueEUR = 0

      for (const p of activePositions) {
        const pk = `${p.company}|||${p.symbol}`
        try {
          // Try to find existing daily price first to avoid re-fetching if already run today
          let dailyPrice = await DailyPrice.findOne({ where: { userId, portfolioId, positionKey: pk, date } })

          if (!dailyPrice) {
            const prev = await fetchPreviousClose(p.symbol)
            if (prev) {
              const { close, currency = 'EUR', source = 'yahoo' } = prev
              const exchangeRate = fxMap[currency] ?? 1
              dailyPrice = await DailyPrice.create({
                userId, portfolioId, positionKey: pk, company: p.company, symbol: p.symbol,
                date, close, currency, exchangeRate, source
              })
            }
          }

          if (dailyPrice) {
            const val = (dailyPrice.close || 0) * (dailyPrice.exchangeRate || 1) * p.shares
            totalValueEUR += val
          }
        } catch (err) {
          const msg = String(err?.message || 'unknown')
          failures.push({ userId, portfolioId, positionKey: pk, reason: msg })
          // continuar con siguiente posición
        }
      }

        // 3. Calculate PnL and Save Snapshot (only if not exists - immutable historical data)
        const pnlEUR = totalValueEUR - totalInvestedEUR

        try {
          const existing = await DailyPortfolioStats.findOne({ where: { userId, portfolioId, date } })
          if (!existing) {
            await DailyPortfolioStats.create({
              userId,
              portfolioId,
              date,
              totalInvestedEUR,
              totalValueEUR,
              pnlEUR
            })
            processed++
          } else {
          }
        } catch (err) {
          const msg = String(err?.message || 'unknown')
          failures.push({ userId, portfolioId, reason: msg })
          // continuar con siguientes portafolios
        }
      }
    }

    if (processed > 0) {
      await setLastRun(date)
      return { ok: true, date, processed, failures }
    }
    return { ok: false, reason: failures.length > 0 ? 'partial_failures' : 'no_data', failures }
  } catch (e) {
    return { ok: false, reason: e.message }
  } finally {
    dailyRunning = false
  }
}

const msUntilTime = (timeStr) => {
  const [hh, mm] = timeStr.split(':').map(x => parseInt(x, 10))
  const now = new Date()
  const target = new Date(now)
  target.setHours(hh, mm, 0, 0)
  if (target <= now) target.setDate(target.getDate() + 1)
  return target.getTime() - now.getTime()
}

export const startDaily = async () => {
  const { enabled, timeStr } = await getConfig()
  if (!enabled) return { ok: false, reason: 'disabled' }
  if (dailyTimer) clearTimeout(dailyTimer)
  const wait = msUntilTime(timeStr)
  dailyTimer = setTimeout(() => {
    runDailyOnce().then(() => {
      // programar siguientes ejecuciones cada 24h
      dailyTimer = setInterval(runDailyOnce, 24 * 60 * 60 * 1000)
    })
  }, wait)
  return { ok: true, timeStr }
}

export const stopDaily = () => {
  if (dailyTimer) {
    clearTimeout(dailyTimer)
    clearInterval(dailyTimer)
  }
  dailyTimer = null
}

export const reloadDaily = async () => {
  stopDaily()
  return startDaily()
}

export default { startDaily, stopDaily, reloadDaily, runDailyOnce }
const getFxMapToEUR = async () => {
  const map = { USD: 1, EUR: 1, GBP: 1 }
  try {
    let key = process.env.FINNHUB_API_KEY || ''
    if (!key) {
      const row = await Config.findOne({ where: { key: 'finnhub_api_key' } })
      key = row?.value || ''
    }
    if (key) {
      const r1 = await fetch(`https://finnhub.io/api/v1/forex/rates?base=EUR&token=${encodeURIComponent(key)}`)
      if (r1.ok) {
        const data = await r1.json()
        const usdPerEur = Number(data?.rates?.USD)
        const gbpPerEur = Number(data?.rates?.GBP)
        if (usdPerEur && usdPerEur > 0) map.USD = 1 / usdPerEur
        if (gbpPerEur && gbpPerEur > 0) map.GBP = 1 / gbpPerEur
        return map
      }
    }
  } catch { }
  try {
    const eurusd = await yahooFinance.quote('EURUSD=X')
    const r = eurusd?.regularMarketPrice || eurusd?.regularMarketPreviousClose
    if (r && r > 0) map.USD = 1 / r
  } catch { }
  try {
    const eurgbp = await yahooFinance.quote('EURGBP=X')
    const r = eurgbp?.regularMarketPrice || eurgbp?.regularMarketPreviousClose
    if (r && r > 0) map.GBP = 1 / r
  } catch { }
  return map
}
