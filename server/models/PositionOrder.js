import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const PositionOrder = sequelize.define('PositionOrder', {
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
        comment: 'Format: "company|||symbol" to uniquely identify a position'
    },
    displayOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Order in which the position should be displayed (lower = first)'
    }
}, {
    tableName: 'PositionOrders',
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
});

export default PositionOrder;
