import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import User from './User.js';

const ExternalLinkButton = sequelize.define('ExternalLinkButton', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE'
    },
    name: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [1, 20],
            is: /^[a-zA-Z0-9_-]+$/ // Solo caracteres alfanuméricos, guiones y guiones bajos
        },
        comment: 'Nombre identificativo del botón (ej: "inest", "yahoo")'
    },
    baseUrl: {
        type: DataTypes.STRING(500),
        allowNull: false,
        validate: {
            notEmpty: true,
            isUrl: true
        },
        comment: 'URL base que se concatenará con el símbolo (ej: "https://nicolas.es/")'
    },
    imageUrl: {
        type: DataTypes.STRING(500),
        allowNull: false,
        validate: {
            notEmpty: true
        },
        comment: 'Ruta relativa o absoluta a la imagen del botón (ej: "/investing.webp")'
    },
    displayOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1,
            max: 3
        },
        comment: 'Orden de visualización (1, 2, 3)'
    }
}, {
    indexes: [
        {
            unique: true,
            fields: ['userId', 'displayOrder'],
            name: 'unique_user_display_order'
        }
    ]
});

// Definir relación
ExternalLinkButton.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' });
User.hasMany(ExternalLinkButton, { foreignKey: 'userId' });

export default ExternalLinkButton;
