import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AssetProfile = sequelize.define('AssetProfile', {
    symbol: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
        comment: 'Símbolo bursátil (ej: AAPL, SAN.MC)'
    },
    sector: {
        type: DataTypes.STRING,
        allowNull: true
    },
    industry: {
        type: DataTypes.STRING,
        allowNull: true
    },
    beta: {
        type: DataTypes.FLOAT,
        allowNull: true,
        comment: 'Beta del activo (volatilidad relativa al mercado)'
    },
    dividendYield: {
        type: DataTypes.FLOAT,
        allowNull: true,
        comment: 'Rentabilidad por dividendo (en %)'
    },
    marketCap: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    currency: {
        type: DataTypes.STRING,
        allowNull: true
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    website: {
        type: DataTypes.STRING,
        allowNull: true
    },
    logoUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'AssetProfiles',
    timestamps: true
});

export default AssetProfile;
