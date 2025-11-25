import express from 'express'
import { authenticate } from '../middleware/auth.js'
import Note from '../models/Note.js'

const router = express.Router()

router.use(authenticate)

router.get('/:positionKey', async (req, res) => {
  try {
    const row = await Note.findOne({ where: { userId: req.user.id, positionKey: req.params.positionKey } })
    res.json({ content: row ? row.content : '' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.put('/:positionKey', async (req, res) => {
  try {
    const content = typeof req.body?.content === 'string' ? req.body.content : ''
    const [row, created] = await Note.findOrCreate({ where: { userId: req.user.id, positionKey: req.params.positionKey }, defaults: { content } })
    if (!created) { row.content = content; await row.save() }
    res.json({ content: row.content })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.delete('/:positionKey', async (req, res) => {
  try {
    await Note.destroy({ where: { userId: req.user.id, positionKey: req.params.positionKey } })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router

