import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'
import User from './User.js'

const Portfolio = sequelize.define('Portfolio', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  }
})

Portfolio.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' })
User.hasMany(Portfolio, { foreignKey: 'userId' })

export default Portfolio

