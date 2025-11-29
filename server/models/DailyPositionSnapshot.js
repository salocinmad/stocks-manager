import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import User from './User.js';
import Portfolio from './Portfolio.js';

const DailyPositionSnapshot = sequelize.define('DailyPositionSnapshot', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
    portfolioId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Portfolios', key: 'id' }, onDelete: 'CASCADE' },
    positionKey: { type: DataTypes.STRING, allowNull: false },
    company: { type: DataTypes.STRING, allowNull: false },
    symbol: { type: DataTypes.STRING, allowNull: true, defaultValue: '' },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    shares: { type: DataTypes.FLOAT, allowNull: false },
    avgCost: { type: DataTypes.FLOAT, allowNull: false, comment: 'Costo promedio por acción' },
    totalInvested: { type: DataTypes.FLOAT, allowNull: false, comment: 'Total invertido en esta posición' },
    currentPrice: { type: DataTypes.FLOAT, allowNull: false },
    totalValue: { type: DataTypes.FLOAT, allowNull: false, comment: 'Valor total de la posición' },
    pnl: { type: DataTypes.FLOAT, allowNull: false, comment: 'Ganancia/Pérdida' },
    pnlPercent: { type: DataTypes.FLOAT, allowNull: false, comment: '% de ganancia/pérdida' },
    currency: { type: DataTypes.STRING, allowNull: false, defaultValue: 'EUR' },
    exchangeRate: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 1 }
}, {
    tableName: 'DailyPositionSnapshots',
    timestamps: true,
    indexes: [
        { unique: true, fields: ['userId', 'portfolioId', 'positionKey', 'date'] },
        { fields: ['userId'] },
        { fields: ['portfolioId'] },
        { fields: ['date'] }
    ]
});

DailyPositionSnapshot.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' });
User.hasMany(DailyPositionSnapshot, { foreignKey: 'userId' });

DailyPositionSnapshot.belongsTo(Portfolio, { foreignKey: 'portfolioId', onDelete: 'CASCADE' });
Portfolio.hasMany(DailyPositionSnapshot, { foreignKey: 'portfolioId' });

export default DailyPositionSnapshot;
