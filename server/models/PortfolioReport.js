import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import User from './User.js';
import Portfolio from './Portfolio.js';

/**
 * Modelo para almacenar reportes generados del portafolio
 * Contiene métricas calculadas y guardadas para consulta rápida
 */
const PortfolioReport = sequelize.define('PortfolioReport', {
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
    portfolioId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Portfolios',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: 'Fecha del reporte'
    },
    reportType: {
        type: DataTypes.ENUM('daily', 'monthly', 'yearly'),
        allowNull: false,
        defaultValue: 'daily',
        comment: 'Tipo de reporte generado'
    },
    data: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
        comment: 'Datos del reporte en formato JSON'
    }
}, {
    tableName: 'PortfolioReports',
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['userId', 'portfolioId', 'date', 'reportType'],
            name: 'unique_portfolio_report'
        },
        {
            fields: ['userId'],
            name: 'idx_report_user'
        },
        {
            fields: ['portfolioId'],
            name: 'idx_report_portfolio'
        },
        {
            fields: ['date'],
            name: 'idx_report_date'
        },
        {
            fields: ['reportType'],
            name: 'idx_report_type'
        }
    ]
});

// Relaciones
PortfolioReport.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' });
User.hasMany(PortfolioReport, { foreignKey: 'userId' });

PortfolioReport.belongsTo(Portfolio, { foreignKey: 'portfolioId', onDelete: 'CASCADE' });
Portfolio.hasMany(PortfolioReport, { foreignKey: 'portfolioId' });

export default PortfolioReport;
