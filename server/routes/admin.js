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
// Nuevos modelos globales
import GlobalCurrentPrice from '../models/GlobalCurrentPrice.js'
import GlobalStockPrice from '../models/GlobalStockPrice.js'
import UserStockAlert from '../models/UserStockAlert.js'
import AssetProfile from '../models/AssetProfile.js'
import { authenticate, isAdmin } from '../middleware/auth.js'
import { encrypt, decrypt } from '../utils/crypto.js'
import { sendNotification } from '../services/notify.js'
import scheduler from '../services/scheduler.js'
import dailyClose from '../services/dailyClose.js'
import multer from 'multer'
import sequelize from '../config/database.js'
import YahooFinance from 'yahoo-finance2'
// Nuevo servicio modular
import { runManualUpdate } from '../services/scheduler/priceScheduler.js'
import { exportToJSON, exportToSQL, importBackup } from '../services/backupService.js'

const upload = multer({ storage: multer.memoryStorage() })
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

router.post('/users/:id/disable-2fa', async (req, res) => {
  try {
    const userId = req.params.id
    const user = await User.findByPk(userId)
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })

    user.isTwoFactorEnabled = false
    user.twoFactorSecret = null
    user.twoFactorTempSecret = null
    await user.save()

    res.json({ message: '2FA desactivado correctamente para el usuario' })
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
    const [affected] = await PriceCache.update({
      targetHitNotifiedAt: null,
      stopLossHitNotifiedAt: null
    }, { where })
    res.json({ success: true, affected })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// BACKUP Y RESTAURACIÓN (Solo Administradores)
// ============================================================================

/**
 * GET /admin/backup/export
 * Exporta un backup completo de la base de datos en formato JSON o SQL
 * Query params: format=json|sql (default: json)
 * Solo accesible por administradores
 */
router.get('/backup/export', isAdmin, async (req, res) => {
  try {
    const format = req.query.format === 'sql' ? 'sql' : 'json'
    const timestamp = new Date().toISOString().split('T')[0]

    console.log(`[Backup] Usuario ${req.user.username} (ID: ${req.user.id}) iniciando exportación en formato ${format.toUpperCase()}`)

    if (format === 'json') {
      const data = await exportToJSON()
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', `attachment; filename=backup_${timestamp}.json`)
      console.log(`[Backup] Exportación JSON completada exitosamente`)
      return res.send(JSON.stringify(data, null, 2))
    } else {
      const sql = await exportToSQL()
      res.setHeader('Content-Type', 'application/sql')
      res.setHeader('Content-Disposition', `attachment; filename=backup_${timestamp}.sql`)
      console.log(`[Backup] Exportación SQL completada exitosamente`)
      return res.send(sql)
    }
  } catch (error) {
    console.error('[Backup] Error en exportación:', error)
    res.status(500).json({
      error: 'Error al exportar el backup',
      details: error.message
    })
  }
})

/**
 * POST /admin/backup/import
 * Importa un backup completo desde un archivo JSON o SQL
 * ADVERTENCIA: Esto eliminará todos los datos existentes
 * Solo accesible por administradores
 */
router.post('/backup/import', isAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Archivo requerido' })
    }

    const filename = req.file.originalname
    const fileSize = (req.file.size / 1024 / 1024).toFixed(2) // MB

    console.log(`[Backup] Usuario ${req.user.username} (ID: ${req.user.id}) iniciando importación`)
    console.log(`[Backup] Archivo: ${filename} (${fileSize} MB)`)
    console.warn(`[Backup] ADVERTENCIA: Se eliminarán todos los datos existentes`)

    const result = await importBackup(req.file.buffer, filename)

    console.log(`[Backup] Importación completada exitosamente (formato: ${result.format})`)
    res.json(result)

    // Recargar configuración del programador después de importación exitosa
    try {
      await scheduler.reload()
      console.log('[Backup] Programador recargado correctamente después de la importación')
    } catch (schedulerError) {
      console.error('[Backup] Error al recargar el programador:', schedulerError)
    }
  } catch (error) {
    console.error('[Backup] Error en importación:', error)

    // Proporcionar mensajes de error más específicos
    let errorMessage = 'Error al importar el backup'
    if (error.name === 'SyntaxError') {
      errorMessage = 'El archivo no tiene un formato válido (JSON o SQL corrupto)'
    } else if (error.message.includes('SQL syntax')) {
      errorMessage = 'Error de sintaxis SQL en el archivo'
    }

    res.status(500).json({
      error: errorMessage,
      details: error.message
    })
  }
})

/**
 * POST /api/admin/update-prices-manual
 * Ejecuta actualización manual de precios (botón "Actualizar Precios")
 */
router.post('/update-prices-manual', async (req, res) => {
  try {
    console.log('🔄 Actualización manual de precios solicitada desde admin panel');
    const result = await runManualUpdate();

    res.json({
      success: true,
      message: `Actualización completada: ${result.updated} acciones actualizadas`,
      stats: result
    });
  } catch (error) {
    console.error('Error en actualización manual:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/overwrite-history
 * Sobrescribe datos históricos de DailyPrice (Botón de emergencia)
 */
router.post('/overwrite-history', async (req, res) => {
  try {
    const { days = 30 } = req.body;
    console.log(`⚠️ Solicitud de sobrescritura de historial recibida (días: ${days})`);

    // Importar dinámicamente el servicio
    const { overwriteHistoricalData } = await import('../services/historicalDataService.js');

    const result = await overwriteHistoricalData(parseInt(days));

    res.json({
      success: true,
      message: `Historial sobrescrito correctamente para ${result.updatedPositions} posiciones.`,
      details: result
    });
  } catch (error) {
    console.error('Error en sobrescritura de historial:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// EDITOR DE OPERACIONES (Solo Administradores)
// ============================================================================

/**
 * GET /api/admin/users-portfolios
 * Lista todos los usuarios con sus portfolios
 */
router.get('/users-portfolios', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username'],
      include: [{
        model: Portfolio,
        attributes: ['id', 'name']
      }],
      order: [['username', 'ASC']]
    });

    const usersWithPortfolios = users.map(user => ({
      userId: user.id,
      username: user.username,
      portfolios: user.Portfolios || []
    }));

    res.json(usersWithPortfolios);
  } catch (error) {
    console.error('Error obteniendo usuarios y portfolios:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/operations/:portfolioId
 * Obtiene todas las operaciones de un portfolio específico
 */
router.get('/operations/:portfolioId', async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.portfolioId);

    // Verificar que el portfolio existe
    const portfolio = await Portfolio.findByPk(portfolioId);
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio no encontrado' });
    }

    const operations = await Operation.findAll({
      where: { portfolioId },
      order: [['date', 'DESC']]
    });

    res.json(operations);
  } catch (error) {
    console.error('Error obteniendo operaciones:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/operations/:operationId
 * Actualiza una operación específica con validaciones
 */
router.put('/operations/:operationId', async (req, res) => {
  try {
    const operationId = parseInt(req.params.operationId);
    const operation = await Operation.findByPk(operationId);

    if (!operation) {
      return res.status(404).json({ error: 'Operación no encontrada' });
    }

    const updateData = { ...req.body };

    // Validaciones básicas
    if (updateData.shares !== undefined && updateData.shares <= 0) {
      return res.status(400).json({ error: 'El número de acciones debe ser mayor que 0' });
    }

    if (updateData.price !== undefined && updateData.price < 0) {
      return res.status(400).json({ error: 'El precio no puede ser negativo' });
    }

    if (updateData.commission !== undefined && updateData.commission < 0) {
      return res.status(400).json({ error: 'La comisión no puede ser negativa' });
    }

    // Convertir fecha si viene en el body
    if (updateData.date) {
      updateData.date = new Date(updateData.date);
    }

    // Actualizar la operación
    await operation.update(updateData);

    res.json({
      success: true,
      operation: operation
    });
  } catch (error) {
    console.error('Error actualizando operación:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/operations/:operationId
 * Elimina una operación
 */
router.delete('/operations/:operationId', async (req, res) => {
  try {
    const operationId = parseInt(req.params.operationId);
    const operation = await Operation.findByPk(operationId);

    if (!operation) {
      return res.status(404).json({ error: 'Operación no encontrada' });
    }

    // Guardar info para el log
    const operationInfo = {
      id: operation.id,
      company: operation.company,
      type: operation.type,
      shares: operation.shares,
      date: operation.date
    };

    // Eliminar la operación
    await operation.destroy();

    console.log('Operación eliminada:', operationInfo);

    res.json({
      success: true,
      message: 'Operación eliminada correctamente',
      operation: operationInfo
    });
  } catch (error) {
    console.error('Error eliminando operación:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/validate-symbol
 * Valida un símbolo y retorna precio actual
 */
router.post('/validate-symbol', async (req, res) => {
  try {
    const { symbol } = req.body;

    if (!symbol || symbol.trim() === '') {
      return res.json({
        valid: false,
        error: 'Símbolo vacío'
      });
    }

    // Importar servicios de precios
    const finnhubService = await import('../services/datasources/finnhubService.js');
    const yahooService = await import('../services/datasources/yahooService.js');

    // Intentar con Finnhub primero
    let priceData = await finnhubService.fetchQuote(symbol);
    let source = 'Finnhub';

    // Si Finnhub falla, intentar con Yahoo
    if (!priceData) {
      priceData = await yahooService.fetchQuote(symbol);
      source = 'Yahoo';
    }

    if (!priceData || !priceData.lastPrice) {
      return res.json({
        valid: false,
        error: 'Símbolo no encontrado',
        source: null
      });
    }

    res.json({
      valid: true,
      price: priceData.lastPrice,
      currency: priceData.currency || 'USD',
      source: source,
      change: priceData.change || 0,
      changePercent: priceData.changePercent || 0
    });
  } catch (error) {
    console.error('Error validando símbolo:', error);
    res.json({
      valid: false,
      error: 'Error al validar símbolo',
      source: null
    });
  }
});

export default router



// Rutas de configuración del programador
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
    const r = await dailyClose.runBackfill(5)
    if (!r.ok) {
      if (r.reason === 'already_running') {
        return res.json({ success: true, status: 'already_running' })
      }
      if (r.reason === 'partial_failures' || r.reason === 'no_data') {
        return res.json({ success: true, status: r.reason, failures: r.failures || [] })
      }
      return res.status(400).json({ error: r.reason || 'run failed' })
    }
    res.json({
      success: true,
      date: r.date || (r.results ? r.results[0]?.date : null),
      processed: r.processed || (r.results ? r.results.filter(x => x.ok).length : 0),
      failures: r.failures || [],
      results: r.results || null
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/daily-close/recompute-last', async (req, res) => {
  try {
    // Importar el servicio PnL
    const { calculatePnLForDate } = await import('../services/pnlService.js')

    // Obtener todos los portafolios
    const portfolios = await Portfolio.findAll({ attributes: ['id', 'userId'] })

    let totalProcessed = 0
    let totalDatesProcessed = 0

    for (const pf of portfolios) {
      const userId = pf.userId
      const portfolioId = pf.id

      // Encontrar todas las fechas únicas en DailyPrice para este portafolio
      const dates = await DailyPrice.findAll({
        where: { userId, portfolioId },
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('date')), 'date']],
        order: [['date', 'ASC']],
        raw: true
      })

      // Recalcular PnL para cada fecha
      for (const { date } of dates) {
        await calculatePnLForDate(userId, portfolioId, date)
        totalDatesProcessed++
      }

      totalProcessed++
    }

    res.json({
      success: true,
      portfolios: totalProcessed,
      dates: totalDatesProcessed,
      message: `Recalculado PnL para ${totalProcessed} portafolios y ${totalDatesProcessed} fechas`
    })
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

