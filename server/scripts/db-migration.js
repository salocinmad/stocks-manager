import { Sequelize, DataTypes } from 'sequelize';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../env/.env') });

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
        host: process.env.DB_HOST,
        dialect: 'mysql',
        logging: false
    }
);

async function runMigration() {
    try {
        await sequelize.authenticate();
        console.log('🔌 Conectado a la base de datos para migración.');

        const queryInterface = sequelize.getQueryInterface();
        const tableDescription = await queryInterface.describeTable('Users');

        if (!tableDescription.isTwoFactorEnabled) {
            console.log('🔄 Añadiendo columna isTwoFactorEnabled...');
            await queryInterface.addColumn('Users', 'isTwoFactorEnabled', {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            });
        }

        if (!tableDescription.twoFactorSecret) {
            console.log('🔄 Añadiendo columna twoFactorSecret...');
            await queryInterface.addColumn('Users', 'twoFactorSecret', {
                type: DataTypes.STRING,
                allowNull: true
            });
        }

        if (!tableDescription.twoFactorTempSecret) {
            console.log('🔄 Añadiendo columna twoFactorTempSecret...');
            await queryInterface.addColumn('Users', 'twoFactorTempSecret', {
                type: DataTypes.STRING,
                allowNull: true
            });
        }

        console.log('✅ Migración de esquema completada.');
    } catch (error) {
        console.error('❌ Error en migración:', error);
    } finally {
        await sequelize.close();
    }
}

runMigration();
