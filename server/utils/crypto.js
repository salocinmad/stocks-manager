import crypto from 'crypto'
import Config from '../models/Config.js'

let cachedKey = null

const ensureKey = async () => {
  if (cachedKey) return cachedKey
  const row = await Config.findOne({ where: { key: 'encryption_key' } })
  let base64
  if (!row) {
    const raw = crypto.randomBytes(32) // 256-bit key
    base64 = raw.toString('base64')
    await Config.create({ key: 'encryption_key', value: base64 })
  } else {
    base64 = row.value
    if (!base64) {
      const raw = crypto.randomBytes(32)
      base64 = raw.toString('base64')
      row.value = base64
      await row.save()
    }
  }
  cachedKey = Buffer.from(base64, 'base64')
  return cachedKey
}

export const encrypt = async (plain) => {
  if (!plain) return ''
  const key = await ensureKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

export const decrypt = async (encoded) => {
  if (!encoded) return ''
  const key = await ensureKey()
  const buf = Buffer.from(String(encoded), 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const data = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(data), decipher.final()])
  return dec.toString('utf8')
}

export default { encrypt, decrypt }
