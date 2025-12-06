import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'
import User from './User.js'
import Portfolio from './Portfolio.js'

const PriceCache = sequelize.define('PriceCache', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  positionKey: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Clave única de posición: "company|||symbol"'
  },
  portfolioId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'Portfolios', key: 'id' },
    onDelete: 'CASCADE'
  },
  lastPrice: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  change: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  changePercent: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  source: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Fuente del precio: yahoo o finnhub'
  },
  targetHitNotifiedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null
  }
}, {
  tableName: 'PriceCaches',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['userId', 'portfolioId', 'positionKey']
    },
    {
      fields: ['userId']
    }
  ]
})

PriceCache.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' })
User.hasMany(PriceCache, { foreignKey: 'userId' })

PriceCache.belongsTo(Portfolio, { foreignKey: 'portfolioId', onDelete: 'CASCADE' })
Portfolio.hasMany(PriceCache, { foreignKey: 'portfolioId' })

export default PriceCache

