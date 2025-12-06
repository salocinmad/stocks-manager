import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'
import User from './User.js'
import Portfolio from './Portfolio.js'

const Note = sequelize.define('Note', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
  portfolioId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Portfolios', key: 'id' }, onDelete: 'CASCADE' },
  positionKey: { type: DataTypes.STRING, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' }
}, {
  tableName: 'Notes',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['userId', 'portfolioId', 'positionKey'] },
    { fields: ['userId'] }
  ]
})

Note.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' })
User.hasMany(Note, { foreignKey: 'userId' })

Note.belongsTo(Portfolio, { foreignKey: 'portfolioId', onDelete: 'CASCADE' })
Portfolio.hasMany(Note, { foreignKey: 'portfolioId' })

export default Note

