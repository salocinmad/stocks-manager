
import YahooFinance from 'yahoo-finance2';
import { getLogLevel } from './configService.js';
import { eq, and, asc } from 'drizzle-orm';

let dailyTimer = null
let dailyRunning = false

import scheduler from './scheduler.js'

// Instancia de Yahoo Finance v3
const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
  queue: {
    concurrency: 1,
    timeout: 300
  }
});

const getConfig = async (db) => {
  const enabledRow = await db.query.configs.findFirst({ where: eq(schema.configs.key, 'daily_close_enabled') });
  const timeRow = await db.query.configs.findFirst({ where: eq(schema.configs.key, 'daily_close_time') });
  const enabled = enabledRow ? enabledRow.value === 'true' : true
  // Por defecto a las 01:00 si no está configurado
  const timeStr = timeRow?.value || '01:00'

  // Si la configuración de hora no existe, crearla con el valor por defecto 01:00
  if (!timeRow) {
    await db.insert(schema.configs).values({ key: 'daily_close_time', value: '01:00' });
  }

  return { enabled, timeStr }
}

const setLastRun = async (iso) => {
  const key = 'daily_close_last_run'
  const val = iso || new Date().toISOString()
  const existing = await db.query.configs.findFirst({ where: eq(schema.configs.key, key) });
  if (existing) {
    await db.update(schema.configs).set({ value: val }).where(eq(schema.configs.key, key));
  } else {
    await db.insert(schema.configs).values({ key, value: val });
  }
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

export const fetchPreviousClose = async (symbol) => {
  try {
    if (!symbol) return null
    const ySymbol = String(symbol).replace(/[:\-]/g, '.')
    const q = await yahooFinance.quote(ySymbol)
    let close = q?.regularMarketPreviousClose || q?.regularMarketPrice || null

    // Capturar change y changePercent desde Yahoo Finance
    const change = q?.regularMarketChange ?? null
    const changePercent = q?.regularMarketChangePercent ?? null

    if (!close || close <= 0) {
      const chart = await yahooFinance.chart(ySymbol, { period1: '7d', interval: '1d' })
      const arr = chart?.quotes || []
      if (arr.length > 0) {
        const last = arr[arr.length - 1]
        close = last?.close || close
      }
    }
    if (!close || close <= 0) return null
    return { close, currency: q?.currency || 'EUR', change, changePercent, source: 'yahoo' }
  } catch {
    return null
  }
}

export const runDailyOnce = async (db) => {
  const currentLogLevel = await getLogLevel(db, eq);
  if (dailyRunning) return { ok: false, reason: 'already_running' }
  dailyRunning = true
  try {
    await scheduler.runOnce(db).catch(() => { })
    const date = await getPreviousBusinessDate()
    const fxMap = await getFxMapToEUR()
    const users = await db.select({ userId: schema.operations.userId }).from(schema.operations).groupBy(schema.operations.userId);
    let processed = 0
    let failures = []
    for (const u of users) {
      const userId = u.userId

      const portfolios = await db.select({ id: schema.portfolios.id }).from(schema.portfolios).where(eq(schema.portfolios.userId, userId));
      for (const pf of portfolios) {
        const portfolioId = pf.id

        // 1. Calcular Posiciones Activas y Coste Total (Capital Invertido)
        const ops = await db.select().from(schema.operations).where(and(eq(schema.operations.userId, userId), eq(schema.operations.portfolioId, portfolioId))).orderBy(asc(schema.operations.date), asc(schema.operations.id));
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
            const avgCost = prev.shares > 0 ? prev.totalCost / prev.shares : 0
            prev.shares -= o.shares
            prev.totalCost -= avgCost * o.shares
          }

          positionsMap.set(key, prev)
        }

        const activePositions = Array.from(positionsMap.values()).filter(p => p.shares > 0)
        const totalInvestedEUR = activePositions.reduce((sum, p) => sum + p.totalCost, 0)

        // 2. Obtener/Actualizar Precios Diarios y Calcular Valor Total de Mercado
        let totalValueEUR = 0

        for (const p of activePositions) {
          const pk = `${p.company}|||${p.symbol}`
          try {
            // Intentar encontrar precio diario existente primero para evitar re-fetch si ya se ejecutó hoy
            let dailyPrice = await db.query.dailyPrices.findFirst({
              where: and(
                eq(schema.dailyPrices.userId, userId),
                eq(schema.dailyPrices.portfolioId, portfolioId),
                eq(schema.dailyPrices.positionKey, pk),
                eq(schema.dailyPrices.date, date)
              )
            });

            if (!dailyPrice) {
              const prev = await fetchPreviousClose(p.symbol)
              if (prev) {
                const { close, currency = 'EUR', source = 'yahoo' } = prev
                const exchangeRate = fxMap[currency] ?? 1
                const newDailyPrice = {
                  userId, portfolioId, positionKey: pk, company: p.company, symbol: p.symbol,
                  date, close, currency, exchangeRate, source,
                  // Nuevos campos de análisis histórico
                  change: prev.change,
                  changePercent: prev.changePercent,
                  shares: p.shares
                };
                await db.insert(schema.dailyPrices).values(newDailyPrice);
                dailyPrice = newDailyPrice; // Assign the newly created object
              }
            }

            if (dailyPrice) {
              const val = (dailyPrice.close || 0) * (dailyPrice.exchangeRate || 1) * p.shares
              totalValueEUR += val
            }

            // Crear snapshot de la posición
            try {
              const existingSnapshot = await db.query.dailyPositionSnapshots.findFirst({
                where: and(
                  eq(schema.dailyPositionSnapshots.userId, userId),
                  eq(schema.dailyPositionSnapshots.portfolioId, portfolioId),
                  eq(schema.dailyPositionSnapshots.positionKey, pk),
                  eq(schema.dailyPositionSnapshots.date, date)
                )
              });
              if (!existingSnapshot && dailyPrice) {
                const avgCost = p.totalCost / p.shares
                const currentPrice = dailyPrice.close * (dailyPrice.exchangeRate || 1)
                const totalValue = currentPrice * p.shares
                const pnl = totalValue - p.totalCost
                const pnlPercent = p.totalCost > 0 ? (pnl / p.totalCost) * 100 : 0

                await db.insert(schema.dailyPositionSnapshots).values({
                  userId,
                  portfolioId,
                  positionKey: pk,
                  company: p.company,
                  symbol: p.symbol,
                  date,
                  shares: p.shares,
                  avgCost,
                  totalInvested: p.totalCost,
                  currentPrice,
                  totalValue,
                  pnl,
                  pnlPercent,
                  currency: dailyPrice.currency,
                  exchangeRate: dailyPrice.exchangeRate
                });
              }
            } catch (snapshotErr) {
              if (currentLogLevel === 'verbose') {
                console.error('Error creando snapshot:', snapshotErr.message)
              }
            }
          } catch (err) {
            const msg = String(err?.message || 'unknown')
            failures.push({ userId, portfolioId, positionKey: pk, reason: msg })
            // continuar con siguiente posición
          }
        }

        // 3. Calcular PnL y Guardar Snapshot (solo si no existe - datos históricos inmutables)
        const pnlEUR = totalValueEUR - totalInvestedEUR

        try {

          // Calcular métricas adicionales para análisis histórico
          const roi = totalInvestedEUR > 0 ? (pnlEUR / totalInvestedEUR) * 100 : 0
          const activePositionsCount = activePositions.length
          const closedOps = ops.filter(o => o.type === 'sale')
          const closedOperationsCount = closedOps.length

          // Buscar estadísticas del día anterior para calcular cambio diario
          let dailyChangeEUR = null
          let dailyChangePercent = null
          try {
            const prevDate = new Date(date)
            prevDate.setDate(prevDate.getDate() - 1)
            const prevDateStr = prevDate.toISOString().split('T')[0]
            const prevStats = await db.query.dailyPortfolioStats.findFirst({
              where: and(
                eq(schema.dailyPortfolioStats.userId, userId),
                eq(schema.dailyPortfolioStats.portfolioId, portfolioId),
                eq(schema.dailyPortfolioStats.date, prevDateStr)
              ),
              orderBy: [desc(schema.dailyPortfolioStats.date)]
            });
            if (prevStats) {
              dailyChangeEUR = totalValueEUR - prevStats.totalValueEUR
              dailyChangePercent = prevStats.totalValueEUR > 0
                ? (dailyChangeEUR / prevStats.totalValueEUR) * 100
                : 0
            }
          } catch (e) {
            // Si no hay datos previos, dejar en null
          }


          const existing = await db.query.dailyPortfolioStats.findFirst({
            where: and(
              eq(schema.dailyPortfolioStats.userId, userId),
              eq(schema.dailyPortfolioStats.portfolioId, portfolioId),
              eq(schema.dailyPortfolioStats.date, date)
            )
          });
          if (!existing) {
            await db.insert(schema.dailyPortfolioStats).values({
              userId,
              portfolioId,
              date,
              totalInvestedEUR,
              totalValueEUR,
              pnlEUR,
              // Nuevos campos de análisis histórico
              dailyChangeEUR,
              dailyChangePercent,
              roi,
              activePositionsCount,
              closedOperationsCount
            });
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


    // 4. Actualizar S&P 500 en la tabla de verdad absoluta (userId=0, portfolioId=0)
    try {
      if (currentLogLevel === 'verbose') {
        console.log('📊 Actualizando S&P 500 en tabla de verdad absoluta...');
      }
      const sp500Symbol = '^GSPC';
      const sp500PositionKey = 'S&P 500|||^GSPC';

      const existing = await db.query.dailyPrices.findFirst({
        where: and(
          eq(schema.dailyPrices.userId, 0),
          eq(schema.dailyPrices.portfolioId, 0),
          eq(schema.dailyPrices.positionKey, sp500PositionKey),
          eq(schema.dailyPrices.date, date)
        )
      });

      if (!existing) {
        const sp500Data = await fetchPreviousClose(sp500Symbol);
        if (sp500Data) {
          const { close, currency = 'USD', change, changePercent, source = 'yahoo' } = sp500Data;
          const exchangeRate = fxMap[currency] ?? 1;

          await db.insert(schema.dailyPrices).values({
            userId: 0,
            portfolioId: 0,
            positionKey: sp500PositionKey,
            company: 'S&P 500',
            symbol: sp500Symbol,
            date,
            close,
            currency,
            exchangeRate,
            source,
            change,
            changePercent,
            shares: 0
          });

          if (currentLogLevel === 'verbose') {
            console.log(`✅ S&P 500 actualizado: ${close} ${currency}`);
          }
        } else {
          console.log('⚠️ No se pudo obtener datos del S&P 500');
        }
      } else {
        if (currentLogLevel === 'verbose') {
          console.log('✓ S&P 500 ya actualizado para hoy');
        }
      }
    } catch (sp500Err) {
      if (currentLogLevel === 'verbose') {
        console.error('❌ Error actualizando S&P 500:', sp500Err.message);
      }
    }

    if (processed > 0) {
      await setLastRun(date);

      // ✨ NUEVO: Generar reportes después del cierre diario exitoso
      if (currentLogLevel === 'verbose') {
        console.log('📊 Iniciando generación de reportes...');
      }
      try {
        // Importar dinámicamente para evitar ciclos de dependencia
        const { generateAllReports } = await import('../scripts/generateReports.js');
        const reportResult = await generateAllReports(date);

        if (reportResult.successfulReports > 0) {
          if (currentLogLevel === 'verbose') {
            console.log(`✅ Reportes generados: ${reportResult.successfulReports} portafolios`);
          }
        }
        if (reportResult.failedReports > 0) {
          if (currentLogLevel === 'verbose') {
            console.log(`⚠️ Algunos reportes fallaron: ${reportResult.failedReports}`);
          }
        }
      } catch (reportError) {
        if (currentLogLevel === 'verbose') {
          console.error('❌ Error generando reportes:', reportError.message);
        }
        // No fallar el cierre diario si falla la generación de reportes
      }

      return { ok: true, date, processed, failures };
    }
    return { ok: false, reason: failures.length > 0 ? 'partial_failures' : 'no_data', failures };
  } catch (e) {
    return { ok: false, reason: e.message };
  } finally {
    dailyRunning = false;
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

export const startDaily = async (db) => {
  const { enabled, timeStr } = await getConfig(db)
  if (!enabled) return { ok: false, reason: 'disabled' }
  if (dailyTimer) clearTimeout(dailyTimer)
  const wait = msUntilTime(timeStr)
  dailyTimer = setTimeout(() => {
    runDailyOnce(db).then(() => {
      // programar siguientes ejecuciones cada 24h
      dailyTimer = setInterval(() => runDailyOnce(db), 24 * 60 * 60 * 1000)
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
  // Defaults razonables en caso de que todas las APIs fallen
  const map = { USD: 0.92, EUR: 1.0, GBP: 0.86 }
  try {
    let key = process.env.FINNHUB_API_KEY || ''
    if (!key) {
      const row = await db.query.configs.findFirst({ where: eq(schema.configs.key, 'finnhub_api_key') });
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
