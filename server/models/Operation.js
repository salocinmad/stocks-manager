import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import User from './User.js';

const Operation = sequelize.define('Operation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  type: {
    type: DataTypes.ENUM('purchase', 'sale'),
    allowNull: false
  },
  company: {
    type: DataTypes.STRING,
    allowNull: false
  },
  symbol: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  shares: {
    type: DataTypes.FLOAT, // Usamos FLOAT para permitir decimales si fuera necesario, aunque el original era Number
    allowNull: false,
    validate: {
      min: 0.0001 // Evitar 0 o negativos, ajustado para permitir fraccionarias si se requiere
    }
  },
  price: {
    type: DataTypes.FLOAT,
    allowNull: false,
    validate: {
      min: 0
    }
  },
  currency: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'EUR'
  },
  exchangeRate: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 1
  },
  commission: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  totalCost: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  targetPrice: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null,
    validate: {
      min: 0
    }
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
});

// Definir relación
Operation.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' });
User.hasMany(Operation, { foreignKey: 'userId' });

export default Operation;
