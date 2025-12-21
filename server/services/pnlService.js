import { Op } from 'sequelize'
import Operation from '../models/Operation.js'
import DailyPrice from '../models/DailyPrice.js'
import DailyPortfolioStats from '../models/DailyPortfolioStats.js'
import { getFxMapToEUR } from '../utils/exchangeRateService.js'

/**
 * Helper para formatear fecha local a YYYY-MM-DD
 */
const toLocalDateStr = (d) => {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

/**
 * Calcula el historial del portafolio (PnL, Valor Total, Total Invertido) para un rango de días.
 * @param {number} userId
 * @param {number} portfolioId
 * @param {number} days
 * @returns {Promise<Array>} Array de estadísticas diarias
 */
export const calculatePortfolioHistory = async (userId, portfolioId, days = 30) => {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const startIso = toLocalDateStr(startDate)
    const endIso = toLocalDateStr(endDate)

    // 1. Obtener todas las operaciones
    const operations = await Operation.findAll({
        where: { userId, portfolioId },
        order: [['date', 'ASC']]
    })

    // 2. Obtener todos los precios diarios dentro del rango
    const prices = await DailyPrice.findAll({
        where: {
            userId,
            portfolioId,
            date: { [Op.gte]: startIso, [Op.lte]: endIso }
        }
    })

    // Agrupar precios por fecha y positionKey
    const pricesByDate = new Map()
    for (const p of prices) {
        if (!pricesByDate.has(p.date)) {
            pricesByDate.set(p.date, new Map())
        }
        pricesByDate.get(p.date).set(p.positionKey, p)
    }

    const fxMap = await getFxMapToEUR()
    const result = []

    // Rastrear últimos precios conocidos
    const lastKnownPrices = new Map()

    // Iterar día a día
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateIso = toLocalDateStr(d)

        // Saltar fines de semana
        const dayOfWeek = d.getDay()
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            continue
        }

        // Calcular estado del portafolio en esta fecha
        const dayOps = operations.filter(o => {
            const opDateStr = toLocalDateStr(new Date(o.date))
            return opDateStr <= dateIso
        })

        // 1. Calcular Capital Neto Inyectado (Purchases - Sales)
        // 2. Calcular Posiciones Abiertas (Shares)
        let netInjectedEUR = 0
        const currentPositions = new Map() // key -> { shares, currency, symbol }

        for (const o of dayOps) {
            if (o.type === 'purchase') {
                netInjectedEUR += o.totalCost
            } else if (o.type === 'sale') {
                netInjectedEUR -= o.totalCost // Ingreso neto de la venta
            }

            const key = `${o.company}|||${o.symbol || ''}`
            if (!currentPositions.has(key)) {
                currentPositions.set(key, { shares: 0, currency: o.currency || 'EUR', symbol: o.symbol })
            }
            const pos = currentPositions.get(key)
            if (o.type === 'purchase') {
                pos.shares += o.shares
            } else if (o.type === 'sale') {
                pos.shares -= o.shares
            }
        }

        // 3. Calcular Valor de Mercado de posiciones abiertas
        let marketValueEUR = 0
        const dayPrices = pricesByDate.get(dateIso) || new Map()

        for (const [key, pos] of currentPositions) {
            if (pos.shares <= 0.000001) continue

            const priceObj = dayPrices.get(key)
            let close = null
            let exchangeRate = null

            if (priceObj && priceObj.close > 0) {
                close = priceObj.close
                exchangeRate = priceObj.exchangeRate
                lastKnownPrices.set(key, { close, exchangeRate })
            } else {
                const lastKnown = lastKnownPrices.get(key)
                if (lastKnown) {
                    close = lastKnown.close
                    exchangeRate = lastKnown.exchangeRate
                } else {
                    // Fallback FX
                    exchangeRate = fxMap[pos.currency] || 1
                    if (pos.symbol && pos.symbol.endsWith('.L') && (pos.currency === 'GBP' || pos.currency === 'GBp')) {
                        exchangeRate = (fxMap['GBP'] || 1.17) * 0.01;
                    }
                }
            }

            if (close && exchangeRate) {
                marketValueEUR += close * exchangeRate * pos.shares
            }
        }

        // PnL Total = Valor Actual - Capital Neto Inyectado
        const totalPnL = marketValueEUR - netInjectedEUR

        result.push({
            date: dateIso,
            totalValueEUR: marketValueEUR,
            totalInvestedEUR: netInjectedEUR, // Aquí representa el capital neto aportado
            pnlEUR: totalPnL
        })
    }

    return result
}



/**
 * Calcula y actualiza el PnL para una fecha específica.
 * @param {number} userId
 * @param {number} portfolioId
 * @param {string} dateIso YYYY-MM-DD
 */
export const calculatePnLForDate = async (userId, portfolioId, dateIso) => {
    // 1. Obtener todas las operaciones (ordenadas por fecha e ID)
    const operations = await Operation.findAll({
        where: { userId, portfolioId },
        order: [['date', 'ASC'], ['id', 'ASC']]
    })

    // 2. Filtrar operaciones hasta la fecha
    const dayOps = operations.filter(o => {
        const opDate = new Date(o.date).toISOString().slice(0, 10)
        return opDate <= dateIso
    })

    // 3. Calcular Posiciones con base de coste promedio
    const finalPositions = new Map()
    for (const o of dayOps) {
        const key = `${o.company}|||${o.symbol || ''}`
        if (!finalPositions.has(key)) {
            finalPositions.set(key, { shares: 0, costBasis: 0 })
        }
        const pos = finalPositions.get(key)

        if (o.type === 'purchase') {
            pos.shares += o.shares
            pos.costBasis += o.totalCost
        } else if (o.type === 'sale') {
            if (pos.shares > 0) {
                const avgCost = pos.costBasis / pos.shares
                const costRemoved = o.shares * avgCost
                pos.shares -= o.shares
                pos.costBasis -= costRemoved
            }
        }
    }

    // 4. Obtener Precios para esa fecha
    const prices = await DailyPrice.findAll({
        where: { userId, portfolioId, date: dateIso }
    })
    const priceMap = new Map()
    for (const p of prices) {
        priceMap.set(p.positionKey, p)
    }

    let totalValueEUR = 0
    let totalInvestedEUR = 0

    for (const [key, pos] of finalPositions) {
        if (pos.shares <= 0.000001) continue

        totalInvestedEUR += pos.costBasis
        const priceObj = priceMap.get(key)
        if (priceObj && priceObj.close > 0) {
            totalValueEUR += priceObj.close * priceObj.exchangeRate * pos.shares
        }
    }

    const pnlEUR = totalValueEUR - totalInvestedEUR

    // 5. Actualizar/Crear DailyPortfolioStats
    const existing = await DailyPortfolioStats.findOne({ where: { userId, portfolioId, date: dateIso } })
    if (existing) {
        await existing.update({ totalInvestedEUR, totalValueEUR, pnlEUR })
    } else {
        await DailyPortfolioStats.create({ userId, portfolioId, date: dateIso, totalInvestedEUR, totalValueEUR, pnlEUR })
    }

    return { date: dateIso, totalInvestedEUR, totalValueEUR, pnlEUR }
}

/**
 * Calcula el análisis mensual de PnL para los últimos 12 meses completados.
 * Excluye el mes actual.
 * @param {number} userId
 * @param {number} portfolioId
 * @returns {Promise<Array>} Array de { month: 'YYYY-MM', gain: number, growthRate: number }
 */
export const calculateMonthlyAnalysis = async (userId, portfolioId) => {
    const monthsToAnalyze = 12
    const results = []

    // Comenzar desde el mes pasado
    const date = new Date()
    date.setDate(1) // Ir al primer día del mes actual
    date.setHours(0, 0, 0, 0)

    for (let i = 0; i < monthsToAnalyze; i++) {
        // Retroceder un mes
        date.setMonth(date.getMonth() - 1)

        // Obtener último día de ese mes
        const year = date.getFullYear()
        const month = date.getMonth()
        const lastDay = new Date(year, month + 1, 0)
        const lastDayIso = lastDay.toISOString().slice(0, 10)
        const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`

        // Calcular PnL para esa fecha
        // Usamos calculatePnLForDate que maneja "último precio conocido" si el mercado estaba cerrado
        // Sin embargo, calculatePnLForDate usa DailyPrice.findAll({ where: { date: dateIso } })
        // Si el último día del mes fue un domingo, podríamos no tener un precio para esa fecha exacta
        // Pero la lógica de calculatePnLForDate (tal como está implementada actualmente) podría necesitar un pequeño ajuste o confiamos en que encuentre precios?
        // Espera, calculatePnLForDate obtiene precios para *esa fecha específica*. 
        // Si esa fecha es un domingo, devuelve precios vacíos, y luego la lógica dice:
        // "if (priceObj && priceObj.close > 0) ... else { // Sin precio ... }"
        // Pero calculatePnLForDate NO implementa la lógica de búsqueda hacia atrás de "último precio conocido" que hace calculatePortfolioHistory.
        // calculatePortfolioHistory itera día a día y mantiene estado. calculatePnLForDate no tiene estado para un solo día.

        // Así que deberíamos usar la lógica de calculatePortfolioHistory pero solo para las fechas específicas que necesitamos?
        // O mejor: Usar calculatePortfolioHistory para todo el rango del año y luego elegir las fechas de fin de mes.
        // Eso es mucho más eficiente y robusto porque maneja naturalmente la continuidad del "último precio conocido".

        // Vamos a cambiar la estrategia: Obtener historial para los últimos 13 meses (para obtener el inicio del primer mes)
        // y luego muestrear las fechas de fin de mes.
    }

    // Nueva Estrategia:
    const today = new Date()
    const endDate = new Date()
    endDate.setDate(0) // Último día del mes anterior

    const startDate = new Date(endDate)
    startDate.setFullYear(startDate.getFullYear() - 1) // 1 año atrás
    startDate.setDate(1) // 1ro de ese mes

    // Calcular días desde HOY hasta startDate para asegurar que cubrimos todo el periodo
    const diffTime = Math.abs(today - startDate)
    const daysToFetch = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 5 // Buffer

    // calculatePortfolioHistory devuelve solo días hábiles (salta fines de semana)
    // También maneja festivos arrastrando el último precio conocido.
    const history = await calculatePortfolioHistory(userId, portfolioId, daysToFetch)

    // Ahora agrupar por mes y elegir la última entrada para cada mes
    const monthlyMap = new Map()

    history.forEach(dayStat => {
        const d = new Date(dayStat.date)
        // Filtrar el mes actual si se coló de alguna manera (aunque establecimos endDate al mes pasado)
        // En realidad calculatePortfolioHistory usa "días" desde hoy. 
        // Así que incluye hoy. Necesitamos filtrar.

        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

        // Queremos el último punto de datos disponible para cada mes
        // Como el historial está ordenado por fecha, podemos simplemente sobrescribir
        monthlyMap.set(monthKey, dayStat)
    })

    // Filtrar mes actual por si acaso
    const currentMonthKey = new Date().toISOString().slice(0, 7)
    if (monthlyMap.has(currentMonthKey)) {
        monthlyMap.delete(currentMonthKey)
    }

    // Convertir a array
    const monthlyStats = Array.from(monthlyMap.entries())
        .map(([month, stat]) => ({
            month,
            gain: stat.pnlEUR, // PnL absoluto al final del mes
            totalValue: stat.totalValueEUR,
            date: stat.date
        }))
        .sort((a, b) => a.month.localeCompare(b.month))

    // Calcular tasa de crecimiento (mes sobre mes)
    // Espera, el usuario quiere "Análisis Mensual".
    // Si muestro "Ganancia: +103", ¿es el PnL de ese mes? ¿O el PnL total?
    // El usuario dijo: "se debera tener el PnL del ultimo dia del mes".
    // Si muestro barras de PnL Total, muestra la tendencia de riqueza.
    // Si muestro barras de Ganancia Mensual (Delta), muestra el rendimiento por mes.
    // La captura de pantalla muestra "Mejor Mes". No puedes tener un "Mejor Mes" de PnL Total (eso es solo "Máximo Histórico").
    // "Mejor Mes" implica el mes donde ganaste más dinero.
    // Así que calcularé el DELTA.
    // Ganancia = PnL(Fin de Mes) - PnL(Fin de Mes Anterior).

    // Calcular PnL ABSOLUTO al final de cada mes (no delta)
    const finalResults = []
    for (let i = 0; i < monthlyStats.length; i++) {
        const current = monthlyStats[i]

        finalResults.push({
            month: current.month,
            gain: current.gain,  // PnL absoluto (total) al final del mes
            growthRate: 0,
            totalValue: current.totalValue
        })
    }

    return finalResults
}

/**
 * Calcula el PnL realizado (cerrado) mensual a partir de ventas.
 * @param {number} userId
 * @param {number} portfolioId
 * @returns {Promise<Array>} Array de { month: 'YYYY-MM', realizedGain: number }
 */
export const calculateRealizedPnLByMonth = async (userId, portfolioId) => {
    const operations = await Operation.findAll({
        where: { userId, portfolioId },
        order: [['date', 'ASC'], ['id', 'ASC']]
    })

    const positions = new Map() // key -> { shares, costBasis }
    const monthlyRealized = new Map() // 'YYYY-MM' -> gain

    for (const op of operations) {
        const key = `${op.company}|||${op.symbol || ''}`
        const monthKey = new Date(op.date).toISOString().slice(0, 7)

        if (!positions.has(key)) {
            positions.set(key, { shares: 0, costBasis: 0 })
        }
        const pos = positions.get(key)

        if (op.type === 'purchase') {
            pos.shares += op.shares
            pos.costBasis += op.totalCost
        } else if (op.type === 'sale') {
            if (pos.shares > 0) {
                const avgCost = pos.costBasis / pos.shares
                const soldCost = avgCost * op.shares
                const saleRevenue = op.totalCost  // totalCost de venta = ingreso
                const realizedGain = saleRevenue - soldCost

                // Sumar al mes
                monthlyRealized.set(monthKey, (monthlyRealized.get(monthKey) || 0) + realizedGain)

                // Actualizar posición
                pos.shares -= op.shares
                pos.costBasis -= soldCost
            }
        }
    }

    return Array.from(monthlyRealized.entries())
        .map(([month, realizedGain]) => ({ month, realizedGain }))
        .sort((a, b) => a.month.localeCompare(b.month))
}
