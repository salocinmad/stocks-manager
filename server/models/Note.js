import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'
import User from './User.js'

const Note = sequelize.define('Note', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
  positionKey: { type: DataTypes.STRING, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' }
}, {
  tableName: 'Notes',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['userId', 'positionKey'] },
    { fields: ['userId'] }
  ]
})

Note.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' })
User.hasMany(Note, { foreignKey: 'userId' })

export default Note

