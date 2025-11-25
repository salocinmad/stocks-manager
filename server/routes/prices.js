import express from 'express'
import { authenticate } from '../middleware/auth.js'
import PriceCache from '../models/PriceCache.js'
import Operation from '../models/Operation.js'
import Config from '../models/Config.js'
import { sendNotification } from '../services/notify.js'

const router = express.Router()

router.use(authenticate)

router.post('/bulk', async (req, res) => {
  try {
    const { positionKeys } = req.body || {}
    if (!Array.isArray(positionKeys) || positionKeys.length === 0) {
      return res.status(400).json({ error: 'positionKeys requerido (array no vacío)' })
    }

    const rows = await PriceCache.findAll({
      where: {
        userId: req.user.id,
        positionKey: positionKeys
      }
    })

    const map = {}
    rows.forEach(r => {
      map[r.positionKey] = {
        price: r.lastPrice,
        change: r.change ?? null,
        changePercent: r.changePercent ?? null,
        updatedAt: r.updatedAt
      }
    })

    res.json({ prices: map })
  } catch (error) {
    console.error('Error fetching cached prices:', error)
    res.status(500).json({ error: 'Error al obtener precios guardados' })
  }
})

router.put('/:positionKey', async (req, res) => {
  try {
    const { positionKey } = req.params
    const { price, change = null, changePercent = null } = req.body || {}
    if (typeof price !== 'number' || isNaN(price)) {
      return res.status(400).json({ error: 'price numérico requerido' })
    }

    const existing = await PriceCache.findOne({
      where: { userId: req.user.id, positionKey }
    })

    if (existing) {
      await existing.update({ lastPrice: price, change, changePercent })
    } else {
      await PriceCache.create({
        userId: req.user.id,
        positionKey,
        lastPrice: price,
        change,
        changePercent
      })
    }

    // Check target price and notify
    try {
      const [company, symbol] = positionKey.includes('|||') ? positionKey.split('|||') : [positionKey, '']
      const where = symbol ? { userId: req.user.id, company, symbol } : { userId: req.user.id, company, symbol: '' }
      const ops = await Operation.findAll({ where })
      const purchases = ops.filter(o => o.type === 'purchase' && o.targetPrice && o.targetPrice > 0)
      if (purchases.length > 0) {
        // Use latest purchase's targetPrice
        purchases.sort((a, b) => new Date(b.date) - new Date(a.date))
        const target = purchases[0].targetPrice
        if (typeof target === 'number' && price >= target) {
          const cacheRow = await PriceCache.findOne({ where: { userId: req.user.id, positionKey } })
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
    } catch (e) {
      // swallow notification errors to not break price upsert
    }
    res.json({ success: true })
  } catch (error) {
    console.error('Error upserting cached price:', error)
    res.status(500).json({ error: 'Error al guardar precio' })
  }
})

export default router

