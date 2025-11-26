import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'
import User from './User.js'

const DailyPortfolioStats = sequelize.define('DailyPortfolioStats', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    totalInvestedEUR: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    totalValueEUR: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    pnlEUR: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 }
}, {
    tableName: 'DailyPortfolioStats',
    timestamps: true,
    indexes: [
        { unique: true, fields: ['userId', 'date'] },
        { fields: ['date'] }
    ]
})

DailyPortfolioStats.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' })
User.hasMany(DailyPortfolioStats, { foreignKey: 'userId' })

export default DailyPortfolioStats
