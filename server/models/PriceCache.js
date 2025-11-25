import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'
import User from './User.js'

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
  }
  ,
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
      fields: ['userId', 'positionKey']
    },
    {
      fields: ['userId']
    }
  ]
})

PriceCache.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' })
User.hasMany(PriceCache, { foreignKey: 'userId' })

export default PriceCache

