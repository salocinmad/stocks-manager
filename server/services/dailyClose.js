import Config from '../models/Config.js'
import Operation from '../models/Operation.js'
import DailyPrice from '../models/DailyPrice.js'
import yahooFinance from 'yahoo-finance2'

let dailyTimer = null
let dailyRunning = false

const getConfig = async () => {
  const enabledRow = await Config.findOne({ where: { key: 'daily_close_enabled' } })
  const timeRow = await Config.findOne({ where: { key: 'daily_close_time' } })
  const enabled = enabledRow ? enabledRow.value === 'true' : true
  const timeStr = timeRow?.value || '06:00'
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
    for (const u of users) {
      const userId = u.userId
      const positions = await Operation.findAll({ where: { userId }, attributes: ['company', 'symbol'], group: ['company', 'symbol'] })
      for (const p of positions) {
        const company = p.company
        const symbol = p.symbol || ''
        const pk = `${company}|||${symbol}`
        const prev = await fetchPreviousClose(symbol)
        if (!prev) continue
        const { close, currency = 'EUR', source = 'yahoo' } = prev
        const exchangeRate = fxMap[currency] ?? 1
        await DailyPrice.upsert({ userId, positionKey: pk, company, symbol, date, close, currency, exchangeRate, source })
      }
    }
    await setLastRun(date)
    return { ok: true, date }
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
    const eurusd = await yahooFinance.quote('EURUSD=X')
    const r = eurusd?.regularMarketPreviousClose || eurusd?.regularMarketPrice
    if (r && r > 0) map.USD = 1 / r
  } catch {}
  try {
    const eurgbp = await yahooFinance.quote('EURGBP=X')
    const r = eurgbp?.regularMarketPreviousClose || eurgbp?.regularMarketPrice
    if (r && r > 0) map.GBP = 1 / r
  } catch {}
  return map
}
