import express from 'express'
import { authenticate } from '../middleware/auth.js'
import Note from '../models/Note.js'
import Portfolio from '../models/Portfolio.js'
import User from '../models/User.js'

const router = express.Router()

router.use(authenticate)

async function resolvePortfolioId(req) {
  const userId = req.user.id
  const raw = req.query.portfolioId || req.body?.portfolioId
  const id = raw ? parseInt(raw, 10) : null
  if (id) {
    const exists = await Portfolio.count({ where: { id, userId } })
    if (exists) return id
  }
  const u = await User.findByPk(userId)
  if (u?.favoritePortfolioId) return u.favoritePortfolioId
  const first = await Portfolio.findOne({ where: { userId }, order: [['id', 'ASC']] })
  return first ? first.id : null
}

router.get('/:positionKey', async (req, res) => {
  try {
    const portfolioId = await resolvePortfolioId(req)
    const row = await Note.findOne({ where: { userId: req.user.id, portfolioId, positionKey: req.params.positionKey } })
    res.json({ content: row ? row.content : '' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.put('/:positionKey', async (req, res) => {
  try {
    const content = typeof req.body?.content === 'string' ? req.body.content : ''
    const portfolioId = await resolvePortfolioId(req)
    const [row, created] = await Note.findOrCreate({ where: { userId: req.user.id, portfolioId, positionKey: req.params.positionKey }, defaults: { content } })
    if (!created) { row.content = content; await row.save() }
    res.json({ content: row.content })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.delete('/:positionKey', async (req, res) => {
  try {
    const portfolioId = await resolvePortfolioId(req)
    await Note.destroy({ where: { userId: req.user.id, portfolioId, positionKey: req.params.positionKey } })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router

