import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'
import User from './User.js'
import Portfolio from './Portfolio.js'

const DailyPrice = sequelize.define('DailyPrice', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
  positionKey: { type: DataTypes.STRING, allowNull: false },
  company: { type: DataTypes.STRING, allowNull: false },
  symbol: { type: DataTypes.STRING, allowNull: true, defaultValue: '' },
  portfolioId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Portfolios', key: 'id' }, onDelete: 'CASCADE' },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  close: { type: DataTypes.FLOAT, allowNull: false },
  currency: { type: DataTypes.STRING, allowNull: false, defaultValue: 'EUR' },
  exchangeRate: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 1 },
  source: { type: DataTypes.STRING, allowNull: true, defaultValue: 'yahoo' },
  // Nuevos campos para análisis histórico mejorado
  change: { type: DataTypes.FLOAT, allowNull: true, defaultValue: null },
  changePercent: { type: DataTypes.FLOAT, allowNull: true, defaultValue: null },
  open: { type: DataTypes.FLOAT, allowNull: true, defaultValue: null },
  high: { type: DataTypes.FLOAT, allowNull: true, defaultValue: null },
  low: { type: DataTypes.FLOAT, allowNull: true, defaultValue: null },
  volume: { type: DataTypes.BIGINT, allowNull: true, defaultValue: null, comment: 'Volumen de negociación' },
  shares: { type: DataTypes.FLOAT, allowNull: true, defaultValue: null }
}, {
  tableName: 'DailyPrices',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['userId', 'portfolioId', 'positionKey', 'date'] },
    { fields: ['userId'] },
    { fields: ['date'] }
  ]
})

DailyPrice.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' })
User.hasMany(DailyPrice, { foreignKey: 'userId' })

DailyPrice.belongsTo(Portfolio, { foreignKey: 'portfolioId', onDelete: 'CASCADE' })
Portfolio.hasMany(DailyPrice, { foreignKey: 'portfolioId' })

export default DailyPrice

