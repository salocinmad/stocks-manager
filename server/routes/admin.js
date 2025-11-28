import express from 'express'
import Portfolio from '../models/Portfolio.js'
import PortfolioReport from '../models/PortfolioReport.js'
import Operation from '../models/Operation.js'
import DailyPortfolioStats from '../models/DailyPortfolioStats.js'
import DailyPrice from '../models/DailyPrice.js'
import DailyPositionSnapshot from '../models/DailyPositionSnapshot.js'
import Note from '../models/Note.js'
import PositionOrder from '../models/PositionOrder.js'
import ProfilePicture from '../models/ProfilePicture.js'
import ExternalLinkButton from '../models/ExternalLinkButton.js'

import User from '../models/User.js'
import PriceCache from '../models/PriceCache.js'
import Config from '../models/Config.js'
import { authenticate, isAdmin } from '../middleware/auth.js'
import { encrypt, decrypt } from '../utils/crypto.js'
import { sendNotification } from '../services/notify.js'
import scheduler from '../services/scheduler.js'
import dailyClose from '../services/dailyClose.js'
import multer from 'multer'
import sequelize from '../config/database.js'

router.use(authenticate)

router.get('/finnhub-api-key', async (req, res) => {
  try {
    const config = await Config.findOne({ where: { key: 'finnhub-api-key' } })
    if (!config) return res.json({ value: null })
    res.json({ value: config.value })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.use(isAdmin)

router.get('/_ping', async (req, res) => {
  try {
    res.json({ ok: true, user: { id: req.user.id, isAdmin: req.user.isAdmin } })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/_routes', async (req, res) => {
  try {
    res.json({
      routes: ['GET /_ping', 'GET /users', 'POST /users', 'DELETE /users/:id', 'PUT /users/:id/password', 'GET /finnhub-api-key', 'POST /finnhub-api-key', 'POST /smtp', 'POST /notify-test', 'GET /smtp-pass']
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/users', async (req, res) => {
  try {
    const users = await User.findAll({ attributes: { exclude: ['password'] }, order: [['createdAt', 'DESC']] })
    res.json(users)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/users', async (req, res) => {
  try {
    const { username, password, isAdmin: adminFlag } = req.body
    if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña son requeridos' })
    const existingUser = await User.findOne({ where: { username: username.toLowerCase() } })
    if (existingUser) return res.status(400).json({ error: 'El usuario ya existe' })
    const newUser = await User.create({ username: username.toLowerCase(), password, isAdmin: adminFlag || false })
    const userResponse = newUser.toJSON()
    delete userResponse.password
    res.status(201).json(userResponse)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.delete('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id
    if (parseInt(userId) === req.user.id) return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' })
    const user = await User.findByPk(userId)
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
    await user.destroy()
    res.json({ message: 'Usuario eliminado correctamente' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/reset-admin-password', async (req, res) => {
  try {
    const { masterPassword, newPassword } = req.body
    const MASTER_PASSWORD = process.env.MASTER_PASSWORD || 'Freedom2-Mud9-Garnish7-Tattle4-Vivacious4-Germinate3-Removal9-Harmonics5-Heave6'
    if (!masterPassword || masterPassword !== MASTER_PASSWORD) return res.status(401).json({ error: 'Contraseña maestra incorrecta' })
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' })
    const adminUser = await User.findOne({ where: { isAdmin: true } })
    if (!adminUser) return res.status(404).json({ error: 'No se encontró ningún usuario administrador' })
    adminUser.password = newPassword
    await adminUser.save()
    res.json({ message: 'Contraseña de administrador actualizada correctamente' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.put('/users/:id/password', async (req, res) => {
  try {
    const { newPassword } = req.body
    const userId = req.params.id
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })
    const user = await User.findByPk(userId)
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
    user.password = newPassword
    await user.save()
    res.json({ message: 'Contraseña actualizada correctamente' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/finnhub-api-key', async (req, res) => {
  try {
    const { value } = req.body
    const [config, created] = await Config.findOrCreate({ where: { key: 'finnhub-api-key' }, defaults: { value } })
    if (!created) { config.value = value; await config.save() }
    res.json({ message: 'API Key configurada correctamente', value: config.value })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/smtp', async (req, res) => {
  try {
    const { host, port, user, pass, subject, to } = req.body || {}
    const entries = [
      { key: 'smtp_host', value: host || '' },
      { key: 'smtp_port', value: String(port || '') },
      { key: 'smtp_user', value: user || '' },
      { key: 'smtp_pass', value: pass ? await encrypt(pass) : '' },
      { key: 'smtp_subject', value: subject || '' },
      { key: 'smtp_to', value: Array.isArray(to) ? to.join(',') : (to || '') }
    ]
    for (const { key, value } of entries) {
      const [cfg, created] = await Config.findOrCreate({ where: { key }, defaults: { value } })
      if (!created) { cfg.value = value; await cfg.save() }
    }
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/notify-test', async (req, res) => {
  try {
    const r = await sendNotification({ subject: 'Prueba SMTP', text: 'Prueba de notificación SMTP', html: '<b>Prueba de notificación SMTP</b>' })
    if (!r.ok) return res.status(400).json({ error: r.reason || 'SMTP no configurado' })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/smtp-pass', async (req, res) => {
  try {
    const cfg = await Config.findOne({ where: { key: 'smtp_pass' } })
    const pass = cfg?.value ? await decrypt(cfg.value) : ''
    res.json({ pass })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/reset-alerts', async (req, res) => {
  try {
    const { userId } = req.body || {}
    const where = userId ? { userId } : {}
    const [affected] = await PriceCache.update({ targetHitNotifiedAt: null }, { where })
    res.json({ success: true, affected })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/backup/export', async (req, res) => {
  try {
    const format = req.query.format === 'sql' ? 'sql' : 'json'
    const models = [User, Portfolio, PortfolioReport, Config, Operation, PriceCache, DailyPortfolioStats, DailyPrice, DailyPositionSnapshot, Note, PositionOrder, ProfilePicture, ExternalLinkButton]
    const data = {}

    // Fetch all data
    for (const model of models) {
      data[model.name] = await model.findAll()
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', `attachment; filename=backup_${new Date().toISOString().split('T')[0]}.json`)
      return res.send(JSON.stringify(data, null, 2))
    }

    // SQL Format
    let sql = 'SET FOREIGN_KEY_CHECKS = 0;\n\n'
    for (const model of models) {
      const rows = data[model.name]
      if (rows.length > 0) {
        sql += `TRUNCATE TABLE \`${model.tableName}\`;\n`
        rows.forEach(row => {
          const values = Object.values(row.dataValues).map(v => {
            if (v === null) return 'NULL'
            if (typeof v === 'boolean') return v ? 1 : 0
            if (typeof v === 'number') return v
            if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`
            // Escape single quotes for SQL
            return `'${String(v).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`
          })
          sql += `INSERT INTO \`${model.tableName}\` VALUES (${values.join(', ')});\n`
        })
        sql += '\n'
      }
    }
    sql += 'SET FOREIGN_KEY_CHECKS = 1;\n'

    res.setHeader('Content-Type', 'application/sql')
    res.setHeader('Content-Disposition', `attachment; filename=backup_${new Date().toISOString().split('T')[0]}.sql`)
    res.send(sql)

  } catch (error) {
    console.error('Backup export error:', error)
    res.status(500).json({ error: error.message })
  }
})

router.post('/backup/import', upload.single('file'), async (req, res) => {
  const t = await sequelize.transaction()
  try {
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido' })

    const content = req.file.buffer.toString('utf8')
    const isJson = req.file.originalname.endsWith('.json') || content.trim().startsWith('{')

    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { transaction: t })

    const models = [User, Portfolio, PortfolioReport, Config, Operation, PriceCache, DailyPortfolioStats, DailyPrice, DailyPositionSnapshot, Note, PositionOrder, ProfilePicture, ExternalLinkButton]

    // Truncate all tables first
    for (const model of models) {
      await model.destroy({ where: {}, truncate: true, transaction: t })
    }

    if (isJson) {
      const data = JSON.parse(content)
      for (const model of models) {
        if (data[model.name] && Array.isArray(data[model.name])) {
          if (data[model.name].length > 0) {
            await model.bulkCreate(data[model.name], { transaction: t })
          }
        }
      }
    } else {
      // SQL Import
      const statements = content.split(';').map(s => s.trim()).filter(s => s.length > 0)
      for (const stmt of statements) {
        // Skip SET FOREIGN_KEY_CHECKS as we handle it manually
        if (stmt.toUpperCase().includes('FOREIGN_KEY_CHECKS')) continue
        await sequelize.query(stmt, { transaction: t })
      }
    }

    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { transaction: t })
    await t.commit()

    // Reload scheduler config just in case
    await scheduler.reload()

    res.json({ success: true, message: 'Restauración completada' })
  } catch (error) {
    await t.rollback()
    console.error('Backup import error:', error)
    res.status(500).json({ error: 'Error en restauración: ' + error.message })
  }
})

export default router

// Scheduler config routes
router.get('/scheduler', async (req, res) => {
  try {
    const enabledRow = await Config.findOne({ where: { key: 'scheduler_enabled' } })
    const intervalRow = await Config.findOne({ where: { key: 'scheduler_interval_minutes' } })
    const lastRunRow = await Config.findOne({ where: { key: 'scheduler_last_run' } })
    res.json({
      enabled: enabledRow ? enabledRow.value === 'true' : true,
      intervalMinutes: intervalRow ? parseInt(intervalRow.value || '15', 10) : 15,
      lastRun: lastRunRow?.value || null
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/scheduler', async (req, res) => {
  try {
    const { enabled, intervalMinutes } = req.body || {}
    if (enabled !== undefined) {
      const key = 'scheduler_enabled'
      const val = enabled ? 'true' : 'false'
      const [row, created] = await Config.findOrCreate({ where: { key }, defaults: { value: val } })
      if (!created) { row.value = val; await row.save() }
    }
    if (intervalMinutes !== undefined) {
      const key = 'scheduler_interval_minutes'
      const val = String(Math.max(1, parseInt(intervalMinutes || '15', 10)))
      const [row, created] = await Config.findOrCreate({ where: { key }, defaults: { value: val } })
      if (!created) { row.value = val; await row.save() }
    }
    const r = await scheduler.reload()
    res.json({ success: true, minutes: r.minutes, enabled: r.ok })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/scheduler/run', async (req, res) => {
  try {
    const r = await scheduler.runOnce()
    if (!r.ok) return res.status(400).json({ error: r.reason || 'run failed' })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/daily-close/run', async (req, res) => {
  try {
    const r = await dailyClose.runDailyOnce()
    if (!r.ok) {
      if (r.reason === 'already_running') {
        return res.json({ success: true, status: 'already_running' })
      }
      if (r.reason === 'partial_failures' || r.reason === 'no_data') {
        return res.json({ success: true, status: r.reason, failures: r.failures || [] })
      }
      return res.status(400).json({ error: r.reason || 'run failed' })
    }
    res.json({ success: true, date: r.date, processed: r.processed, failures: r.failures || [] })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/daily-close/recompute-last', async (req, res) => {
  try {
    await scheduler.runOnce().catch(() => { })
    const nowMadrid = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
    const d = new Date(nowMadrid)
    d.setDate(d.getDate() - 1)
    const day = d.getDay()
    if (day === 0) { d.setDate(d.getDate() - 2) } else if (day === 6) { d.setDate(d.getDate() - 1) }
    const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
    let eurPerUsd = null
    try {
      const q = await yahooFinance.quote('EURUSD=X')
      const r = q?.regularMarketPrice || q?.regularMarketPreviousClose
      if (r && r > 0) eurPerUsd = 1 / r
    } catch { }
    if (!eurPerUsd || eurPerUsd <= 0) eurPerUsd = 0.92

    const portfolios = await Portfolio.findAll({ attributes: ['id', 'userId'] })
    let processed = 0
    for (const pf of portfolios) {
      const userId = pf.userId
      const portfolioId = pf.id
      const ops = await Operation.findAll({ where: { userId, portfolioId } })
      const positionsMap = new Map()
      for (const o of ops) {
        const key = `${o.company}|||${o.symbol || ''}`
        const prev = positionsMap.get(key) || { company: o.company, symbol: o.symbol || '', shares: 0, totalCost: 0 }
        if (o.type === 'purchase') {
          prev.shares += o.shares
          prev.totalCost += parseFloat(o.totalCost)
        } else if (o.type === 'sale') {
          prev.shares -= o.shares
          prev.totalCost -= parseFloat(o.totalCost)
        }
        positionsMap.set(key, prev)
      }
      const activePositions = Array.from(positionsMap.values()).filter(p => p.shares > 0)
      let totalInvestedEUR = activePositions.reduce((sum, p) => sum + p.totalCost, 0)
      let totalValueEUR = 0
      for (const p of activePositions) {
        const pk = `${p.company}|||${p.symbol}`
        const cache = await PriceCache.findOne({ where: { userId, portfolioId, positionKey: pk } })
        if (!cache || !cache.lastPrice || cache.lastPrice <= 0) continue
        const companyOps = ops.filter(o => {
          const k = o.symbol ? `${o.company}|||${o.symbol}` : o.company
          return k === pk
        })
        const purchases = companyOps.filter(o => o.type === 'purchase')
        let currency = purchases.length > 0 ? (purchases.sort((a, b) => new Date(b.date) - new Date(a.date))[0].currency || 'EUR') : 'EUR'
        let rate = 1
        if (currency === 'USD') {
          rate = eurPerUsd
        } else if (currency !== 'EUR') {
          let totalShares = 0
          let totalExchangeRateWeighted = 0
          for (const pur of purchases) {
            totalShares += pur.shares
            totalExchangeRateWeighted += pur.shares * (pur.exchangeRate || 1)
          }
          rate = totalShares > 0 ? (totalExchangeRateWeighted / totalShares) : (purchases[0]?.exchangeRate || 1)
        }
        const valEUR = cache.lastPrice * rate * p.shares
        totalValueEUR += valEUR

        const existingPrice = await DailyPrice.findOne({ where: { userId, portfolioId, positionKey: pk, date: iso } })
        if (existingPrice) {
          await existingPrice.update({ company: p.company, symbol: p.symbol, close: cache.lastPrice, currency, exchangeRate: rate, source: cache.source || 'cache' })
        } else {
          await DailyPrice.create({ userId, portfolioId, positionKey: pk, company: p.company, symbol: p.symbol, date: iso, close: cache.lastPrice, currency, exchangeRate: rate, source: cache.source || 'cache' })
        }
      }
      const pnlEUR = totalValueEUR - totalInvestedEUR
      const existing = await DailyPortfolioStats.findOne({ where: { userId, portfolioId, date: iso } })
      if (existing) {
        await existing.update({ totalInvestedEUR, totalValueEUR, pnlEUR })
      } else {
        await DailyPortfolioStats.create({ userId, portfolioId, date: iso, totalInvestedEUR, totalValueEUR, pnlEUR })
      }
      processed++
    }
    res.json({ success: true, date: iso, processed })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /admin/reports/generate
 * Forzar generación de reportes para todos los portafolios
 */
router.post('/reports/generate', async (req, res) => {
  try {
    // Importar dinámicamente para evitar ciclos de dependencia
    const { generateAllReports } = await import('../scripts/generateReports.js');


    // Ejecutar generación de reportes
    const result = await generateAllReports();

    if (result.failedReports > 0) {
      return res.status(207).json({
        success: true,
        status: 'partial',
        count: result.successfulReports,
        totalPortfolios: result.totalPortfolios,
        failedReports: result.failedReports,
        errors: result.errors,
        executionTimeMs: result.executionTimeMs
      });
    }

    res.json({
      success: true,
      status: 'complete',
      count: result.successfulReports,
      totalPortfolios: result.totalPortfolios,
      executionTimeMs: result.executionTimeMs
    });
  } catch (error) {
    console.error('Error generating reports from admin:', error);
    res.status(500).json({ error: error.message });
  }
})

