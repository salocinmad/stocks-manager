import Config from '../models/Config.js'
import Operation from '../models/Operation.js'
import PriceCache from '../models/PriceCache.js'
import Portfolio from '../models/Portfolio.js'
import { sendNotification } from './notify.js'
import yahooFinance from 'yahoo-finance2';

let timer = null
let running = false

const getIntervalMinutes = async () => {
  const enabledRow = await Config.findOne({ where: { key: 'scheduler_enabled' } })
  const intervalRow = await Config.findOne({ where: { key: 'scheduler_interval_minutes' } })
  const enabled = enabledRow ? enabledRow.value === 'true' : true
  const minutes = intervalRow ? parseInt(intervalRow.value || '15', 10) : 15
  return { enabled, minutes: Math.max(1, minutes || 15) }
}

const setLastRun = async () => {
  const key = 'scheduler_last_run'
  const now = new Date().toISOString()
  const [row, created] = await Config.findOrCreate({ where: { key }, defaults: { value: now } })
  if (!created) { row.value = now; await row.save() }
}

const fetchPriceYahoo = async (symbol) => {
  try {
    if (!symbol) return null
    const quote = await yahooFinance.quote(symbol)
    const price = quote?.regularMarketPrice || quote?.postMarketPrice || quote?.preMarketPrice
    const change = quote?.regularMarketChange ?? null
    const changePercent = quote?.regularMarketChangePercent ?? null
    if (!price || price <= 0) return null
    return { price, change, changePercent }
  } catch {
    return null
  }
}

const fetchPriceFinnhub = async (symbol) => {
  try {
    const apiKeyRow = await Config.findOne({ where: { key: 'finnhub-api-key' } })
    const token = apiKeyRow?.value || ''
    if (!token || !symbol) return null
    const resp = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`)
    if (!resp.ok) return null
    const data = await resp.json()
    if (data?.c > 0) {
      return { price: data.c, change: data.d ?? null, changePercent: data.dp ?? null }
    }
    return null
  } catch {
    return null
  }
}

const checkAndNotify = async (userId, portfolioId, company, symbol, positionKey, price) => {
  const ops = await Operation.findAll({ where: { userId, portfolioId, company, symbol: symbol || '' } })
  const purchases = ops.filter(o => o.type === 'purchase' && o.targetPrice && o.targetPrice > 0)
  if (purchases.length === 0) return
  purchases.sort((a, b) => new Date(b.date) - new Date(a.date))
  const target = purchases[0].targetPrice
  if (typeof target === 'number' && price >= target) {
    const cacheRow = await PriceCache.findOne({ where: { userId, portfolioId, positionKey } })
    const already = cacheRow?.targetHitNotifiedAt
    if (!already) {
      const subjectCfg = await Config.findOne({ where: { key: 'smtp_subject' } })
      const subjectBase = subjectCfg?.value || 'Alerta de precios'
      const niceName = symbol ? `${company} (${symbol})` : company
      const r = await sendNotification({
        subject: `${subjectBase}: ${niceName} alcanzó objetivo`,
        text: `${niceName} ha alcanzado el precio objetivo de ${target}. Precio actual: ${price}.`,
        html: `<p><b>${niceName}</b> ha alcanzado el precio objetivo de <b>${target}</b>.<br/>Precio actual: <b>${price}</b>.</p>`
      })
      if (r.ok && cacheRow) {
        await cacheRow.update({ targetHitNotifiedAt: new Date() })
      }
    }
  }
}

export const runOnce = async () => {
  if (running) return { ok: false, reason: 'already_running' }
  running = true
  let updateCount = 0
  try {
    const users = await Operation.findAll({ attributes: ['userId'], group: ['userId'] })
    for (const u of users) {
      const userId = u.userId
      const portfolios = await Portfolio.findAll({ where: { userId } })
      for (const pf of portfolios) {
        const portfolioId = pf.id
        const positions = await Operation.findAll({ where: { userId, portfolioId }, attributes: ['company', 'symbol'], group: ['company', 'symbol'] })
        for (const p of positions) {
          const company = p.company
          const symbol = p.symbol || ''
          const positionKey = `${company}|||${symbol}`
          let priceData = await fetchPriceFinnhub(symbol)
          let source = 'finnhub'
          if (!priceData) {
            priceData = await fetchPriceYahoo(symbol)
            source = 'yahoo'
          }
          if (!priceData) continue
          const { price, change = null, changePercent = null } = priceData
          const existing = await PriceCache.findOne({ where: { userId, portfolioId, positionKey } })
          if (existing) {
            await existing.update({ lastPrice: price, change, changePercent, source, updatedAt: new Date() })
            updateCount++
          } else {
            await PriceCache.create({ userId, portfolioId, positionKey, lastPrice: price, change, changePercent, source })
            updateCount++
          }
          await checkAndNotify(userId, portfolioId, company, symbol, positionKey, price)
        }
      }
    }
    await setLastRun()
    return { ok: true }
  } catch (e) {
    console.error('❌ Scheduler error:', e.message)
    return { ok: false, reason: e.message }
  } finally {
    running = false
  }
}

export const start = async () => {
  const { enabled, minutes } = await getIntervalMinutes()
  if (!enabled) return { ok: false, reason: 'disabled' }
  if (timer) clearInterval(timer)
  timer = setInterval(runOnce, minutes * 60 * 1000)
  return { ok: true, minutes }
}

export const stop = () => {
  if (timer) clearInterval(timer)
  timer = null
}

export const reload = async () => {
  stop()
  return start()
}

export default { start, stop, reload, runOnce }

