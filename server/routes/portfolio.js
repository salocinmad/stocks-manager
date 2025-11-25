import express from 'express'
import { Op } from 'sequelize'
import { authenticate } from '../middleware/auth.js'
import Operation from '../models/Operation.js'
import DailyPrice from '../models/DailyPrice.js'
import Config from '../models/Config.js'

const router = express.Router()
router.use(authenticate)

const sharesByPosition = async (userId) => {
  const ops = await Operation.findAll({ where: { userId } })
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
    const dateParam = req.query.date
    const lastRunRow = await Config.findOne({ where: { key: 'daily_close_last_run' } })
    const last = lastRunRow?.value || null
    const date = dateParam || (last ? last.slice(0, 10) : null)
    if (!date) {
      return res.json({ date: null, items: [] })
    }
    const positions = await sharesByPosition(userId)
    const items = []
    for (const p of positions) {
      const pk = `${p.company}|||${p.symbol}`
      const row = await DailyPrice.findOne({ where: { userId, positionKey: pk, date: { [Op.lte]: date } }, order: [['date','DESC']] })
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

export default router
router.get('/timeseries', async (req, res) => {
  try {
    const userId = req.user.id
    const days = Math.max(1, parseInt(req.query.days || '30', 10))
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceDate = since.toISOString().slice(0, 10)
    const rows = await DailyPrice.findAll({
      where: { userId, date: { [Op.gte]: sinceDate } },
      order: [['date', 'ASC']]
    })
    const map = new Map()
    for (const r of rows) {
      const v = (r.close || 0) * (r.exchangeRate || 1)
      const prev = map.get(r.date) || 0
      // shares por posición
      // obtener shares actuales por positionKey
      // optimización: precargar sharesByPosition
    }
    const pos = await sharesByPosition(userId)
    const sharesMap = new Map(pos.map(p => [`${p.company}|||${p.symbol}`, p.shares]))
    for (const r of rows) {
      const key = `${r.company}|||${r.symbol || ''}`
      const sh = sharesMap.get(key) || 0
      const add = ((r.close || 0) * (r.exchangeRate || 1)) * sh
      map.set(r.date, (map.get(r.date) || 0) + add)
    }
    const result = Array.from(map.entries()).map(([date, totalValueEUR]) => ({ date, totalValueEUR }))
    res.json({ days, items: result })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
