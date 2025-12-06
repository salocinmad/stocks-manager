import express from 'express'
import Config from '../models/Config.js'
import { authenticate } from '../middleware/auth.js'

const router = express.Router()

router.use(authenticate)

const cache = new Map()

router.get('/companies', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim()
    if (q.length < 3) return res.json({ result: [] })

    const key = q.toLowerCase()
    const now = Date.now()
    const ttlMs = 5 * 60 * 1000
    const hit = cache.get(key)
    if (hit && now - hit.t <= ttlMs) {
      return res.json({ result: hit.r })
    }

    let token = process.env.FINNHUB_API_KEY || ''
    if (!token) {
      const cfg = await Config.findOne({ where: { key: 'finnhub-api-key' } })
      token = cfg?.value || ''
    }
    if (!token) return res.status(400).json({ error: 'Finnhub API key no configurada' })

    const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${encodeURIComponent(token)}`
    const r = await fetch(url)
    if (!r.ok) return res.status(r.status).json({ error: 'Error consultando Finnhub' })
    const data = await r.json()
    const result = Array.isArray(data.result) ? data.result.slice(0, 30) : []
    cache.set(key, { r: result, t: now })
    return res.json({ result })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

export default router
