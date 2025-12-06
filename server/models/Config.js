import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Config = sequelize.define('Config', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  value: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

export default Config;
