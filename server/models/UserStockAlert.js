import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import User from './User.js';
import Portfolio from './Portfolio.js';

/**
 * Modelo de alertas de precio por usuario
 * Metadata de usuario para targetPrice y notificaciones
 */
const UserStockAlert = sequelize.define('UserStockAlert', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE'
    },
    portfolioId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Portfolios', key: 'id' },
        onDelete: 'CASCADE'
    },
    symbol: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Símbolo para esta alerta'
    },
    targetPrice: {
        type: DataTypes.FLOAT,
        allowNull: true,
        comment: 'Precio objetivo para notificación'
    },
    targetHitNotifiedAt: {
        type: DataTypes.DATE,
        allowNull: true
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
    tableName: 'UserStockAlerts',
    timestamps: true,
    indexes: [
        { unique: true, fields: ['userId', 'portfolioId', 'symbol'] },
        { fields: ['userId'] },
        { fields: ['symbol'] }
    ]
});

// Relaciones
UserStockAlert.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' });
User.hasMany(UserStockAlert, { foreignKey: 'userId' });

UserStockAlert.belongsTo(Portfolio, { foreignKey: 'portfolioId', onDelete: 'CASCADE' });
Portfolio.hasMany(UserStockAlert, { foreignKey: 'portfolioId' });

export default UserStockAlert;
