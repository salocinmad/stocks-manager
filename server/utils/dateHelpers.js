/**
 * Utilidades para manejo de fechas
 * Funciones puras sin efectos secundarios
 */

/**
 * Obtiene el día de mercado anterior (excluye fines de semana)
 * @param {Date} date - Fecha de referencia (default: hoy)
 * @returns {string} Fecha en formato 'YYYY-MM-DD'
 */
export function getPreviousMarketDay(date = new Date()) {
    const prevDay = new Date(date);
    prevDay.setDate(prevDay.getDate() - 1);

    // Retroceder hasta encontrar día hábil
    while (prevDay.getDay() === 0 || prevDay.getDay() === 6) {
        prevDay.setDate(prevDay.getDate() - 1);
    }

    return prevDay.toISOString().split('T')[0];
}

/**
 * Obtiene el siguiente día de mercado (excluye fines de semana)
 * @param {Date} date - Fecha de referencia
 * @returns {string} Fecha en formato 'YYYY-MM-DD'
 */
export function getNextMarketDay(date = new Date()) {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    // Avanzar hasta encontrar día hábil
    while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
        nextDay.setDate(nextDay.getDate() + 1);
    }

    return nextDay.toISOString().split('T')[0];
}

/**
 * Calcula número de días de mercado entre dos fechas
 * @param {string|Date} startDate - Fecha inicial
 * @param {string|Date} endDate - Fecha final
 * @returns {number} Número de días hábiles
 */
export function getMarketDaysBetween(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    let count = 0;
    const current = new Date(start);

    while (current <= end) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }

    return count;
}

/**
 * Verifica si una fecha es día hábil
 * @param {Date} date - Fecha a verificar
 * @returns {boolean} true si es día hábil
 */
export function isMarketDay(date) {
    const dayOfWeek = date.getDay();
    return dayOfWeek !== 0 && dayOfWeek !== 6;
}

/**
 * Convierte timestamp Unix a Date
 * @param {number} timestamp - Unix timestamp en segundos
 * @returns {Date} Objeto Date
 */
export function unixToDate(timestamp) {
    return new Date(timestamp * 1000);
}

/**
 * Formatea fecha a 'YYYY-MM-DD'
 * @param {Date} date - Fecha a formatear
 * @returns {string} Fecha formateada
 */
export function formatDateOnly(date) {
    return date.toISOString().split('T')[0];
}

/**
 * Obtiene fecha de hace N días
 * @param {number} days - Número de días hacia atrás
 * @returns {string} Fecha en formato 'YYYY-MM-DD'
 */
export function getDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return formatDateOnly(date);
}

/**
 * Calcula edad de un timestamp en minutos
 * @param {Date} timestamp - Timestamp a comparar
 * @returns {number} Minutos transcurridos
 */
export function getMinutesSince(timestamp) {
    return Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
}

export default {
    getPreviousMarketDay,
    getNextMarketDay,
    getMarketDaysBetween,
    isMarketDay,
    unixToDate,
    formatDateOnly,
    getDaysAgo,
    getMinutesSince,
};
