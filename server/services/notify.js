import nodemailer from 'nodemailer'
import Config from '../models/Config.js'
import { decrypt } from '../utils/crypto.js'

const getConfig = async () => {
  const keys = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_subject', 'smtp_to']
  const map = {}
  for (const k of keys) {
    const row = await Config.findOne({ where: { key: k } })
    map[k] = row ? row.value : ''
  }
  return map
}

export const sendNotification = async ({ subject, text, html } = {}) => {
  try {
    const cfg = await getConfig()
    const host = cfg.smtp_host
    const port = parseInt(cfg.smtp_port || '587', 10)
    const user = cfg.smtp_user
    const pass = cfg.smtp_pass ? await decrypt(cfg.smtp_pass) : ''
    const to = (cfg.smtp_to || '').split(',').map(s => s.trim()).filter(Boolean)
    const defaultSubject = cfg.smtp_subject || 'Alerta de precios'

    if (!host || !port || !user || !pass || to.length === 0) {
      return { ok: false, reason: 'SMTP no configurado' }
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    })

    const info = await transporter.sendMail({
      from: user,
      to,
      subject: subject || defaultSubject,
      text: text || html?.replace(/<[^>]*>/g, '') || '',
      html: html || undefined
    })

    return { ok: true, id: info.messageId }
  } catch (err) {
    return { ok: false, reason: err.message }
  }
}

export default { sendNotification }
