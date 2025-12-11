import { db } from '../config/database.js'
import * as schema from '../drizzle/schema.js'
import { sql } from 'drizzle-orm'

/**
 * Lista de tablas a incluir en el backup (en orden de dependencias)
 */
const BACKUP_TABLES = [
  { modelName: 'Users', tableName: 'Users', table: schema.users },
  { modelName: 'Portfolios', tableName: 'Portfolios', table: schema.portfolios },
  { modelName: 'Configs', tableName: 'Configs', table: schema.configs },
  { modelName: 'Operations', tableName: 'Operations', table: schema.operations },
  { modelName: 'GlobalCurrentPrices', tableName: 'GlobalCurrentPrices', table: schema.globalCurrentPrices },
  { modelName: 'GlobalStockPrices', tableName: 'GlobalStockPrices', table: schema.globalStockPrices },
  { modelName: 'UserStockAlerts', tableName: 'UserStockAlerts', table: schema.userStockAlerts },
  { modelName: 'AssetProfiles', tableName: 'AssetProfiles', table: schema.assetProfiles },
  { modelName: 'PriceCaches', tableName: 'PriceCaches', table: schema.priceCaches },
  { modelName: 'DailyPrices', tableName: 'DailyPrices', table: schema.dailyPrices },
  { modelName: 'DailyPortfolioStats', tableName: 'DailyPortfolioStats', table: schema.dailyPortfolioStats },
  { modelName: 'DailyPositionSnapshots', tableName: 'DailyPositionSnapshots', table: schema.dailyPositionSnapshots },
  { modelName: 'Notes', tableName: 'Notes', table: schema.notes },
  { modelName: 'PositionOrders', tableName: 'PositionOrders', table: schema.positionOrders },
  { modelName: 'ProfilePictures', tableName: 'ProfilePictures', table: schema.profilePictures },
  { modelName: 'ExternalLinkButtons', tableName: 'ExternalLinkButtons', table: schema.externalLinkButtons }
]

/**
 * Escapa un valor para SQL
 * @param {*} value - Valor a escapar
 * @returns {string} - Valor escapado para SQL
 */
function escapeSQLValue(value) {
    if (value === null) return 'NULL'
    if (typeof value === 'boolean') return value ? 'true' : 'false'
    if (typeof value === 'number') return value
    if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`

    // Escapar todos los caracteres especiales para SQL
    const escaped = String(value)
        .replace(/\\/g, '\\\\')      // Escapar backslashes primero
        .replace(/'/g, "\\'")        // Escapar comillas simples
        .replace(/"/g, '\\"')        // Escapar comillas dobles
        .replace(/\n/g, '\\n')       // Escapar saltos de línea
        .replace(/\r/g, '\\r')       // Escapar retornos de carro
        .replace(/\t/g, '\\t')       // Escapar tabulaciones
        .replace(/\x00/g, '\\0')     // Escapar null bytes

    return `'${escaped}'`
}

/**
 * Exporta todos los datos en formato JSON
 * @returns {Promise<Object>} - Objeto con todos los datos
 */
export async function exportToJSON() {
    const data = {}

    for (const t of BACKUP_TABLES) {
        data[t.modelName] = await db.select().from(t.table)
    }

    return data
}

/**
 * Exporta todos los datos en formato SQL
 * @returns {Promise<string>} - String con el SQL completo
 */
export async function exportToSQL() {
    const data = await exportToJSON()
    let sql = '-- Backup generado el ' + new Date().toISOString() + '\n'
    sql += '-- ADVERTENCIA: Este script eliminará todos los datos existentes\n\n'
    sql += 'SET FOREIGN_KEY_CHECKS = 0;\n\n'

    for (const model of BACKUP_MODELS) {
        const rows = data[model.name]
        if (rows.length > 0) {
            sql += `-- Tabla: ${model.tableName}\n`
            sql += `TRUNCATE TABLE \`${model.tableName}\`;\n`

            rows.forEach(row => {
                const columns = Object.keys(row.dataValues)
                const columnNames = columns.map(c => `\`${c}\``).join(', ')
                const values = columns.map(col => escapeSQLValue(row.dataValues[col]))

                sql += `INSERT INTO \`${model.tableName}\` (${columnNames}) VALUES (${values.join(', ')});\n`
            })

            sql += '\n'
        }
    }

    sql += 'SET FOREIGN_KEY_CHECKS = 1;\n'
    return sql
}

/**
 * Parsea un archivo SQL en statements individuales, respetando strings
 * @param {string} content - Contenido del archivo SQL
 * @returns {Array<string>} - Array de statements SQL
 */
function parseSQLStatements(content) {
    const statements = []
    let current = ''
    let inString = false
    let escapeNext = false

    for (let i = 0; i < content.length; i++) {
        const char = content[i]

        if (escapeNext) {
            current += char
            escapeNext = false
            continue
        }

        if (char === '\\') {
            current += char
            escapeNext = true
            continue
        }

        if (char === "'") {
            inString = !inString
            current += char
            continue
        }

        if (char === ';' && !inString) {
            const stmt = current.trim()
            if (stmt.length > 0) {
                statements.push(stmt)
            }
            current = ''
            continue
        }

        current += char
    }

    // Agregar último statement si existe
    if (current.trim().length > 0) {
        statements.push(current.trim())
    }

    return statements
}

/**
 * Importa datos desde un objeto JSON
 * @param {Object} data - Datos a importar
 * @param {Object} transaction - Transacción de Sequelize
 */
async function importFromJSON(data, tx) {
    for (const t of BACKUP_TABLES) {
        if (data[t.modelName] && Array.isArray(data[t.modelName])) {
            if (data[t.modelName].length > 0) {
                await tx.insert(t.table).values(data[t.modelName])
            }
        }
    }
}

/**
 * Importa datos desde un string SQL
 * @param {string} content - Contenido SQL
 * @param {Object} transaction - Transacción de Sequelize
 */
async function importFromSQL(content, transaction) {
    const statements = parseSQLStatements(content)

    for (const stmt of statements) {
        // Omitir SET FOREIGN_KEY_CHECKS ya que lo manejamos manualmente
        if (stmt.toUpperCase().includes('FOREIGN_KEY_CHECKS')) continue
        // Omitir comentarios
        if (stmt.startsWith('--')) continue

        await transaction.execute(sql.raw(stmt));
    }
}

/**
 * Importa datos desde un archivo (JSON o SQL)
 * @param {Buffer} fileBuffer - Buffer del archivo
 * @param {string} filename - Nombre del archivo
 * @returns {Promise<Object>} - Resultado de la importación
 */
export async function importBackup(fileBuffer, filename) {
    return db.transaction(async (tx) => {
        try {
            const content = fileBuffer.toString('utf8')
            const isJson = filename.endsWith('.json') || content.trim().startsWith('{')

            // Truncar todas las tablas con CASCADE
            for (const t of BACKUP_TABLES) {
                await tx.execute(sql`TRUNCATE TABLE ${t.table} CASCADE`)
            }

            // Importar datos
            if (isJson) {
                const data = JSON.parse(content)
                await importFromJSON(data, tx)
            } else {
                await importFromSQL(content, tx)
            }

            return {
                success: true,
                message: 'Restauración completada correctamente',
                format: isJson ? 'JSON' : 'SQL'
            }
        } catch (error) {
            console.error('Error en importBackup:', error)
            throw error
        }
    })
}
