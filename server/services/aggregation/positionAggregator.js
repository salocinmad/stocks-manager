/**
 * Agregador de Posiciones
 * Funciones puras para agrupar y calcular posiciones desde operaciones
 */

import { createPositionKey } from '../../utils/symbolHelpers.js';

/**
 * Agrupa operaciones por positionKey
 * @param {Array} operations - Array de operaciones
 * @returns {Object} Objeto con operaciones agrupadas por positionKey
 */
export function groupOperationsByPosition(operations) {
    const grouped = {};

    operations.forEach(op => {
        const key = createPositionKey(op.company, op.symbol);

        if (!grouped[key]) {
            grouped[key] = {
                positionKey: key,
                company: op.company,
                symbol: op.symbol || '',
                purchases: [],
                sales: [],
                currency: op.currency
            };
        }

        if (op.type === 'purchase') {
            grouped[key].purchases.push(op);
        } else if (op.type === 'sale') {
            grouped[key].sales.push(op);
        }
    });

    return grouped;
}

/**
 * Calcula posiciones activas desde operaciones
 * @param {Array} operations - Array de operaciones
 * @returns {Object} Objeto con posiciones activas
 */
export function calculateActivePositions(operations) {
    const positions = {};

    // CRÍTICO: Ordenar operaciones por fecha cronológicamente, luego por ID
    const sortedOperations = [...operations].sort((a, b) => {
        const dateCompare = new Date(a.date) - new Date(b.date);
        if (dateCompare !== 0) return dateCompare;
        // Si las fechas son iguales, ordenar por ID (menor ID = más antiguo)
        return (a.id || 0) - (b.id || 0);
    });

    sortedOperations.forEach(op => {
        const key = createPositionKey(op.company, op.symbol);

        if (!positions[key]) {
            positions[key] = {
                positionKey: key,
                company: op.company,
                symbol: op.symbol || '',
                shares: 0,
                totalCost: 0,
                totalOriginalCost: 0,
                currency: op.currency || 'EUR',
                operations: []
            };
        }

        const sharesDelta = op.type === 'purchase' ? op.shares : -op.shares;
        positions[key].shares += sharesDelta;

        if (op.type === 'purchase') {
            positions[key].totalCost += op.totalCost;
            positions[key].totalOriginalCost += op.shares * op.price;
        } else {
            // En ventas, reducir el coste proporcionalmente
            const proportion = op.shares / (positions[key].shares + op.shares);
            positions[key].totalCost -= positions[key].totalCost * proportion;
            positions[key].totalOriginalCost -= positions[key].totalOriginalCost * proportion;
        }

        positions[key].operations.push(op);
    });

    // Filtrar solo las posiciones activas (con shares > 0)
    const activePositions = {};
    Object.keys(positions).forEach(key => {
        if (positions[key].shares > 0) {
            activePositions[key] = positions[key];
        }
    });

    return activePositions;
}

/**
 * Obtiene símbolos únicos de un array de operaciones
 * @param {Array} operations - Array de operaciones
 * @returns {Array<string>} Array de símbolos únicos
 */
export function getUniqueSymbolsFromOperations(operations) {
    const symbols = new Set();

    operations.forEach(op => {
        if (op.symbol && op.symbol.trim() !== '') {
            symbols.add(op.symbol);
        }
    });

    return Array.from(symbols);
}

/**
 * Calcula shares por posición para un portfolio
 * @param {Array} operations - Array de operaciones
 * @returns {Map} Map con shares por positionKey
 */
export function calculateSharesByPosition(operations) {
    const map = new Map();

    for (const op of operations) {
        const key = createPositionKey(op.company, op.symbol);
        const prev = map.get(key) || {
            company: op.company,
            symbol: op.symbol || '',
            shares: 0
        };
        prev.shares += (op.type === 'purchase' ? op.shares : -op.shares);
        map.set(key, prev);
    }

    return map;
}

export default {
    groupOperationsByPosition,
    calculateActivePositions,
    getUniqueSymbolsFromOperations,
    calculateSharesByPosition
};
