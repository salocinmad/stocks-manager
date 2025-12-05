
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const sequelize = new Sequelize(
    process.env.DB_NAME || process.env.MYSQL_DATABASE || 'portfolio_manager',
    process.env.DB_USER || process.env.MYSQL_USER || 'user',
    process.env.DB_PASS || process.env.MYSQL_PASSWORD || 'password',
    {
        host: process.env.DB_HOST || 'mariadb',
        port: Number(process.env.DB_PORT || 3306),
        dialect: 'mysql',
        logging: console.log,
    }
);

const runMigration = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to database.');

        const [results] = await sequelize.query("SHOW COLUMNS FROM `AssetProfiles` LIKE 'isin'");

        if (results.length === 0) {
            console.log('⚠️ Column `isin` missing. Adding it...');
            await sequelize.query("ALTER TABLE `AssetProfiles` ADD COLUMN `isin` VARCHAR(255) NULL UNIQUE;");
            console.log('✅ Column `isin` added successfully.');
        } else {
            console.log('✅ Column `isin` already exists.');
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await sequelize.close();
    }
};

runMigration();
