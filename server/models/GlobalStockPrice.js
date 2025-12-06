import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Modelo global de precios históricos
 * Un registro por (símbolo, fecha) - compartido entre todos los usuarios
 */
const GlobalStockPrice = sequelize.define('GlobalStockPrice', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },

    // Identificación
    symbol: {
        type: DataTypes.STRING,
        allowNull: false
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },

    // OHLCV (Yahoo Finance)
    open: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    high: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    low: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    close: {
        type: DataTypes.FLOAT,
        allowNull: false,
        comment: 'Precio de cierre'
    },
    volume: {
        type: DataTypes.BIGINT,
        allowNull: true
    },

    // Calculados
    change: {
        type: DataTypes.FLOAT,
        allowNull: true,
        comment: 'close - previousClose (del día anterior en DB)'
    },
    changePercent: {
        type: DataTypes.FLOAT,
        allowNull: true,
        comment: '(change / previousClose) * 100'
    },

    // Yahoo específico
    adjClose: {
        type: DataTypes.FLOAT,
        allowNull: true,
        comment: 'Precio ajustado por splits/dividendos'
    },

    // Metadata
    source: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: 'yahoo',
        comment: 'Siempre yahoo para históricos'
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
    }
}, {
    tableName: 'GlobalStockPrices',
    timestamps: true,
    indexes: [
        { unique: true, fields: ['symbol', 'date'] },  // ← CRUCIAL: 1 registro por (symbol, date)
        { fields: ['symbol'] },
        { fields: ['date'] },
        { fields: ['createdAt'] }
    ]
});

export default GlobalStockPrice;
