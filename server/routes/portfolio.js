import express from 'express'
import { Op } from 'sequelize'
import { db } from '../config/database.js';
import * as schema from '../drizzle/schema.js';
import { eq, and, desc, asc, lte } from 'drizzle-orm';

const router = express.Router()
router.use(authenticate)

const sharesByPosition = async (userId, portfolioId) => {
  const ops = await Operation.findAll({ where: { userId, portfolioId } })
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
    const lastRunRow = await Config.findOne({ where: { key: 'daily_close_last_run' } })
    const last = lastRunRow?.value || null
    const date = dateParam || (last ? last.slice(0, 10) : null)
    if (!date) {
      return res.json({ date: null, items: [] })
    }
    const positions = await sharesByPosition(userId, portfolioId)
    const items = []
    for (const p of positions) {
      const pk = `${p.company}|||${p.symbol}`
      const rowResult = await db.select().from(dailyPrices)
        .where(and(
          eq(dailyPrices.userId, userId),
          eq(dailyPrices.portfolioId, portfolioId),
          eq(dailyPrices.positionKey, pk),
          lte(dailyPrices.date, date)
        ))
        .orderBy(desc(dailyPrices.date))
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
    const items = await Portfolio.findAll({ where: { userId }, order: [['id', 'ASC']] })
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
    const p = await Portfolio.create({ userId, name })
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
    const p = await Portfolio.findOne({ where: { id, userId } })
    if (!p) return res.status(404).json({ error: 'Portafolio no encontrado' })
    const t = await Portfolio.sequelize.transaction()
    try {
      await Operation.destroy({ where: { userId, portfolioId: id }, transaction: t })
      await PriceCache.destroy({ where: { userId, portfolioId: id }, transaction: t })
      await DailyPrice.destroy({ where: { userId, portfolioId: id }, transaction: t })
      await DailyPortfolioStats.destroy({ where: { userId, portfolioId: id }, transaction: t })
      await Note.destroy({ where: { userId, portfolioId: id }, transaction: t })
      await PositionOrder.destroy({ where: { userId, portfolioId: id }, transaction: t })
      await p.destroy({ transaction: t })
      await User.update({ favoritePortfolioId: null }, { where: { id: userId, favoritePortfolioId: id }, transaction: t })
      await t.commit()
    } catch (e) {
      await t.rollback()
      throw e
    }
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
    const pResult = await db.select().from(portfolios).where(and(eq(portfolios.id, id), eq(portfolios.userId, userId))).limit(1);
    const p = pResult[0];
    if (!p) return res.status(404).json({ error: 'Portafolio no encontrado' })
    await db.update(schema.users).set({ favoritePortfolioId: id }).where(eq(schema.users.id, userId));
    res.json({ ok: true, favoritePortfolioId: id })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
