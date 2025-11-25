import express from 'express'
import User from '../models/User.js'
import PriceCache from '../models/PriceCache.js'
import Config from '../models/Config.js'
import { authenticate, isAdmin } from '../middleware/auth.js'
import { encrypt, decrypt } from '../utils/crypto.js'
import { sendNotification } from '../services/notify.js'
import scheduler from '../services/scheduler.js'
import dailyClose from '../services/dailyClose.js'

const router = express.Router()

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
    if (!r.ok) return res.status(400).json({ error: r.reason || 'run failed' })
    res.json({ success: true, date: r.date })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
