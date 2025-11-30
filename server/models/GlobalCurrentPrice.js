import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Modelo global de precios actuales (tiempo real)
 * Un registro por símbolo (compartido entre todos los usuarios)
 */
const GlobalCurrentPrice = sequelize.define('GlobalCurrentPrice', {
    // Clave primaria
    symbol: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
        comment: 'Símbolo único (AAPL, AMP.MC, etc.)'
    },

    // Precio actual (FINNHUB PRIORITY)
    lastPrice: {
        type: DataTypes.FLOAT,
        allowNull: false,
        comment: 'Precio actual del mercado'
    },
    change: {
        type: DataTypes.FLOAT,
        allowNull: true,
        comment: 'Cambio absoluto vs previousClose'
    },
    changePercent: {
        type: DataTypes.FLOAT,
        allowNull: true,
        comment: 'Cambio porcentual'
    },

    // OHLC del día (FINNHUB PRIORITY)
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

    // Cierre anterior (FINNHUB PRIORITY)
    previousClose: {
        type: DataTypes.FLOAT,
        allowNull: true,
        comment: 'Precio de cierre del día anterior'
    },
    previousCloseDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: 'Fecha del cierre anterior (para PnL preciso)'
    },

    // Datos adicionales (YAHOO COMPLEMENTA)
    volume: {
        type: DataTypes.BIGINT,
        allowNull: true,
        comment: 'Volumen del día (Yahoo)'
    },
    marketState: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'OPEN, CLOSED, PRE, POST (Yahoo)'
    },
    currency: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'USD, EUR, etc. (Yahoo)'
    },
    exchange: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'NASDAQ, BME, etc. (Yahoo)'
    },
    regularMarketTime: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Timestamp último tick (Yahoo)'
    },

    // Metadata
    source: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'finnhub, yahoo, o finnhub+yahoo'
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Última actualización del scheduler'
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false
    }
}, {
    tableName: 'GlobalCurrentPrices',
    timestamps: true,
    indexes: [
        { unique: true, fields: ['symbol'] },
        { fields: ['updatedAt'] },
        { fields: ['source'] },
        { fields: ['currency'] }
    ]
});

export default GlobalCurrentPrice;
