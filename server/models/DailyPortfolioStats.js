import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'
import User from './User.js'
import Portfolio from './Portfolio.js'

const DailyPortfolioStats = sequelize.define('DailyPortfolioStats', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
    portfolioId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Portfolios', key: 'id' }, onDelete: 'CASCADE' },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    totalInvestedEUR: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    totalValueEUR: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    pnlEUR: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    // Nuevos campos para análisis histórico mejorado
    dailyChangeEUR: { type: DataTypes.FLOAT, allowNull: true, defaultValue: null },
    dailyChangePercent: { type: DataTypes.FLOAT, allowNull: true, defaultValue: null },
    roi: { type: DataTypes.FLOAT, allowNull: true, defaultValue: null },
    activePositionsCount: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
    closedOperationsCount: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 }
}, {
    tableName: 'DailyPortfolioStats',
    timestamps: true,
    indexes: [
        { unique: true, fields: ['userId', 'portfolioId', 'date'] },
        { fields: ['date'] }
    ]
})

DailyPortfolioStats.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' })
User.hasMany(DailyPortfolioStats, { foreignKey: 'userId' })

DailyPortfolioStats.belongsTo(Portfolio, { foreignKey: 'portfolioId', onDelete: 'CASCADE' })
Portfolio.hasMany(DailyPortfolioStats, { foreignKey: 'portfolioId' })

export default DailyPortfolioStats
