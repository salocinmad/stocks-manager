import express from 'express'

import { db } from '../config/database.js';
import * as schema from '../drizzle/schema.js';
import { eq, and, desc, asc, lte } from 'drizzle-orm';
import { authenticate } from '../middleware/auth.js';

const router = express.Router()
router.use(authenticate)

const sharesByPosition = async (userId, portfolioId) => {
  const ops = await db.select({ company: schema.operations.company, symbol: schema.operations.symbol, type: schema.operations.type, shares: schema.operations.shares })
    .from(schema.operations)
    .where(and(eq(schema.operations.userId, userId), eq(schema.operations.portfolioId, portfolioId)));
  const map = new Map()
  for (const o of ops) {
    const key = `${o.company}|||${o.symbol || ''}`
    const prev = map.get(key) || { company: o.company, symbol: o.symbol || '', shares: 0 }
    prev.shares += (o.type === 'purchase' ? o.shares : -o.shares)
    map.set(key, prev)
  }
  return Array.from(map.values()).filter(p => p.shares > 0)
}

router.get('/contribution', async (req, res) => {
  try {
    const userId = req.user.id
    const portfolioId = req.query.portfolioId ? parseInt(req.query.portfolioId, 10) : null
    const dateParam = req.query.date
    const lastRunRow = await db.query.configs.findFirst({ where: eq(schema.configs.key, 'daily_close_last_run') });
    const last = lastRunRow?.value || null
    const date = dateParam || (last ? last.slice(0, 10) : null)
    if (!date) {
      return res.json({ date: null, items: [] })
    }
    const positions = await sharesByPosition(userId, portfolioId)
    const items = []
    for (const p of positions) {
      const pk = `${p.company}|||${p.symbol}`
      const rowResult = await db.select().from(schema.dailyPrices)
        .where(and(
          eq(schema.dailyPrices.userId, userId),
          eq(schema.dailyPrices.portfolioId, portfolioId),
          eq(schema.dailyPrices.positionKey, pk),
          lte(schema.dailyPrices.date, date)
        ))
        .orderBy(desc(schema.dailyPrices.date))
        .limit(1);
      const row = rowResult[0];
      if (!row) continue
      const valueEUR = (row.close || 0) * p.shares * (row.exchangeRate || 1)
      items.push({ name: p.company, valueEUR })
    }
    const total = items.reduce((s, it) => s + it.valueEUR, 0)
    const result = items.map(it => ({ name: it.name, valueEUR: it.valueEUR, percent: total > 0 ? it.valueEUR / total : 0 }))
    res.json({ date, totalEUR: total, items: result })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/timeseries', async (req, res) => {
  try {
    const userId = req.user.id
    const portfolioId = req.query.portfolioId ? parseInt(req.query.portfolioId, 10) : null
    const days = Math.max(1, parseInt(req.query.days || '30', 10))
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceDate = since.toISOString().slice(0, 10)

    // Usar servicio de cálculo dinámico
    const { calculatePortfolioHistory } = await import('../services/pnlService.js')
    const history = await calculatePortfolioHistory(userId, portfolioId, days)

    // Mapear al contrato del frontend: totalValueEUR representa pnlEUR para el gráfico
    let result = history.map(h => ({ date: h.date, totalValueEUR: h.pnlEUR }))

    // Excluir el día actual
    const today = new Date().toISOString().slice(0, 10)
    result = result.filter(item => item.date !== today)

    res.json({ days, items: result })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router

// Listar portafolios del usuario
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id
    const items = await db.select().from(schema.portfolios).where(eq(schema.portfolios.userId, userId)).orderBy(asc(schema.portfolios.id))
    res.json({ items })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Crear portafolio
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id
    const name = (req.body?.name || '').trim()
    if (!name) return res.status(400).json({ error: 'Nombre requerido' })
    const [p] = await db.insert(schema.portfolios).values({ userId, name }).returning()
    res.status(201).json({ item: p })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Renombrar portafolio
router.patch('/:id', async (req, res) => {
  try {
    const userId = req.user.id
    const id = parseInt(req.params.id, 10)
    const name = (req.body?.name || '').trim()
    if (!name) return res.status(400).json({ error: 'Nombre requerido' })
    const p = await db.query.portfolios.findFirst({
      where: and(eq(schema.portfolios.id, id), eq(schema.portfolios.userId, userId))
    });
    if (!p) return res.status(404).json({ error: 'Portafolio no encontrado' })
    await db.update(schema.portfolios).set({ name }).where(eq(schema.portfolios.id, id));
    res.json({ item: { ...p, name } })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Eliminar portafolio (cascade por FK)
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id
    const id = parseInt(req.params.id, 10)
    const pResult = await db.select().from(schema.portfolios).where(and(eq(schema.portfolios.id, id), eq(schema.portfolios.userId, userId))).limit(1);
    const p = pResult[0];
    if (!p) return res.status(404).json({ error: 'Portafolio no encontrado' })
    await db.transaction(async (tx) => {
      await tx.delete(schema.operations).where(and(eq(schema.operations.userId, userId), eq(schema.operations.portfolioId, id)));
      await tx.delete(schema.priceCaches).where(and(eq(schema.priceCaches.userId, userId), eq(schema.priceCaches.portfolioId, id)));
      await tx.delete(schema.dailyPrices).where(and(eq(schema.dailyPrices.userId, userId), eq(schema.dailyPrices.portfolioId, id)));
      await tx.delete(schema.dailyPortfolioStats).where(and(eq(schema.dailyPortfolioStats.userId, userId), eq(schema.dailyPortfolioStats.portfolioId, id)));
      await tx.delete(schema.notes).where(and(eq(schema.notes.userId, userId), eq(schema.notes.portfolioId, id)));
      await tx.delete(schema.positionOrders).where(and(eq(schema.positionOrders.userId, userId), eq(schema.positionOrders.portfolioId, id)));
      await tx.delete(schema.portfolios).where(eq(schema.portfolios.id, id));
      await tx.update(schema.users).set({ favoritePortfolioId: null }).where(and(eq(schema.users.id, userId), eq(schema.users.favoritePortfolioId, id)));
    });
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Marcar favorito
router.put('/:id/favorite', async (req, res) => {
  try {
    const userId = req.user.id
    const id = parseInt(req.params.id, 10)
    const pResult = await db.select().from(schema.portfolios).where(and(eq(schema.portfolios.id, id), eq(schema.portfolios.userId, userId))).limit(1);
    const p = pResult[0];
    if (!p) return res.status(404).json({ error: 'Portafolio no encontrado' })
    await db.update(schema.users).set({ favoritePortfolioId: id }).where(eq(schema.users.id, userId));
    res.json({ ok: true, favoritePortfolioId: id })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
