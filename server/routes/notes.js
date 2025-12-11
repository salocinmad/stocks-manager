import express from 'express'
import { authenticate } from '../middleware/auth.js'
import { db } from '../config/database.js'
import * as schema from '../drizzle/schema.js'
import { eq, and, asc } from 'drizzle-orm'

const router = express.Router()

router.use(authenticate)

async function resolvePortfolioId(req) {
  const userId = req.user.id
  const raw = req.query.portfolioId || req.body?.portfolioId
  const id = raw ? parseInt(raw, 10) : null
  if (id) {
    const exists = await db.select({ id: schema.portfolios.id }).from(schema.portfolios).where(and(eq(schema.portfolios.id, id), eq(schema.portfolios.userId, userId))).limit(1)
    if (exists[0]) return id
  }
  const uRes = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1)
  const u = uRes[0]
  if (u?.favoritePortfolioId) return u.favoritePortfolioId
  const firstRes = await db.select({ id: schema.portfolios.id }).from(schema.portfolios).where(eq(schema.portfolios.userId, userId)).orderBy(asc(schema.portfolios.id)).limit(1)
  return firstRes[0] ? firstRes[0].id : null
}

router.get('/:positionKey', async (req, res) => {
  try {
    const portfolioId = await resolvePortfolioId(req)
    const row = await db.query.notes.findFirst({ where: and(eq(schema.notes.userId, req.user.id), eq(schema.notes.portfolioId, portfolioId), eq(schema.notes.positionKey, req.params.positionKey)) })
    res.json({ content: row ? row.content : '' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.put('/:positionKey', async (req, res) => {
  try {
    const content = typeof req.body?.content === 'string' ? req.body.content : ''
    const portfolioId = await resolvePortfolioId(req)
    const [row] = await db.insert(schema.notes).values({ userId: req.user.id, portfolioId, positionKey: req.params.positionKey, content }).onConflictDoUpdate({ target: [schema.notes.userId, schema.notes.portfolioId, schema.notes.positionKey], set: { content } }).returning()
    res.json({ content: row.content })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.delete('/:positionKey', async (req, res) => {
  try {
    const portfolioId = await resolvePortfolioId(req)
    await db.delete(schema.notes).where(and(eq(schema.notes.userId, req.user.id), eq(schema.notes.portfolioId, portfolioId), eq(schema.notes.positionKey, req.params.positionKey)))
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router

