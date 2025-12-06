import sequelize from '../config/database.js'
import User from '../models/User.js'
import Portfolio from '../models/Portfolio.js'
import PortfolioReport from '../models/PortfolioReport.js'
import Config from '../models/Config.js'
import Operation from '../models/Operation.js'
import GlobalCurrentPrice from '../models/GlobalCurrentPrice.js'
import GlobalStockPrice from '../models/GlobalStockPrice.js'
import UserStockAlert from '../models/UserStockAlert.js'
import AssetProfile from '../models/AssetProfile.js'
import PriceCache from '../models/PriceCache.js'
import DailyPrice from '../models/DailyPrice.js'
import DailyPortfolioStats from '../models/DailyPortfolioStats.js'
import DailyPositionSnapshot from '../models/DailyPositionSnapshot.js'
import Note from '../models/Note.js'
import PositionOrder from '../models/PositionOrder.js'
import ProfilePicture from '../models/ProfilePicture.js'
import ExternalLinkButton from '../models/ExternalLinkButton.js'

/**
 * Lista de modelos a incluir en el backup (en orden de dependencias)
 */
const BACKUP_MODELS = [
    User,
    Portfolio,
    PortfolioReport,
    Config,
    Operation,
    // Tablas globales
    GlobalCurrentPrice,
    GlobalStockPrice,
    UserStockAlert,
    AssetProfile,
    // Tablas heredadas
    PriceCache,
    DailyPrice,
    // Resto de tablas
    DailyPortfolioStats,
    DailyPositionSnapshot,
    Note,
    PositionOrder,
    ProfilePicture,
    ExternalLinkButton
]

/**
 * Escapa un valor para SQL
 * @param {*} value - Valor a escapar
 * @returns {string} - Valor escapado para SQL
 */
function escapeSQLValue(value) {
    if (value === null) return 'NULL'
    if (typeof value === 'boolean') return value ? 1 : 0
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

    for (const model of BACKUP_MODELS) {
        data[model.name] = await model.findAll()
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
async function importFromJSON(data, transaction) {
    for (const model of BACKUP_MODELS) {
        if (data[model.name] && Array.isArray(data[model.name])) {
            if (data[model.name].length > 0) {
                await model.bulkCreate(data[model.name], { transaction })
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

        await sequelize.query(stmt, { transaction })
    }
}

/**
 * Importa datos desde un archivo (JSON o SQL)
 * @param {Buffer} fileBuffer - Buffer del archivo
 * @param {string} filename - Nombre del archivo
 * @returns {Promise<Object>} - Resultado de la importación
 */
export async function importBackup(fileBuffer, filename) {
    const transaction = await sequelize.transaction()

    try {
        const content = fileBuffer.toString('utf8')
        const isJson = filename.endsWith('.json') || content.trim().startsWith('{')

        // Deshabilitar foreign key checks
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { transaction })

        // Truncar todas las tablas
        for (const model of BACKUP_MODELS) {
            await model.destroy({ where: {}, truncate: true, transaction })
        }

        // Importar datos
        if (isJson) {
            const data = JSON.parse(content)
            await importFromJSON(data, transaction)
        } else {
            await importFromSQL(content, transaction)
        }

        // Rehabilitar foreign key checks
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { transaction })

        await transaction.commit()

        return {
            success: true,
            message: 'Restauración completada correctamente',
            format: isJson ? 'JSON' : 'SQL'
        }
    } catch (error) {
        await transaction.rollback()
        throw error
    }
}
