import { Sequelize } from 'sequelize';
// import dotenv from 'dotenv';
// dotenv.config();

const sequelize = new Sequelize(
    process.env.DB_NAME || 'portfolio_manager',
    process.env.DB_USER || 'user',
    process.env.DB_PASS || 'password',
    {
        host: process.env.DB_HOST || 'mariadb',
        dialect: 'mysql',
        logging: console.log,
    }
);

const runMigration = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Conectado a la base de datos.');

        // 1. Migrar DailyPortfolioStats
        console.log('\n🔄 Migrando DailyPortfolioStats...');
        const statsColumns = [
            { name: 'dailyChangeEUR', type: 'FLOAT NULL DEFAULT NULL' },
            { name: 'dailyChangePercent', type: 'FLOAT NULL DEFAULT NULL' },
            { name: 'roi', type: 'FLOAT NULL DEFAULT NULL' },
            { name: 'activePositionsCount', type: 'INT NULL DEFAULT 0' },
            { name: 'closedOperationsCount', type: 'INT NULL DEFAULT 0' }
        ];

        for (const col of statsColumns) {
            try {
                await sequelize.query(`ALTER TABLE DailyPortfolioStats ADD COLUMN ${col.name} ${col.type};`);
                console.log(`  ✅ Columna agregada: ${col.name}`);
            } catch (error) {
                if (error.original && error.original.code === 'ER_DUP_FIELDNAME') {
                    console.log(`  ℹ️ La columna ${col.name} ya existe.`);
                } else {
                    console.error(`  ❌ Error agregando ${col.name}:`, error.message);
                }
            }
        }

        // 2. Migrar DailyPrices
        console.log('\n🔄 Migrando DailyPrices...');
        const priceColumns = [
            { name: 'change', type: 'FLOAT NULL DEFAULT NULL' },
            { name: 'changePercent', type: 'FLOAT NULL DEFAULT NULL' },
            { name: 'open', type: 'FLOAT NULL DEFAULT NULL' },
            { name: 'high', type: 'FLOAT NULL DEFAULT NULL' },
            { name: 'low', type: 'FLOAT NULL DEFAULT NULL' },
            { name: 'shares', type: 'FLOAT NULL DEFAULT NULL' }
        ];

        for (const col of priceColumns) {
            try {
                // Note: 'change' is a reserved word in some SQL contexts, but usually fine as column name in MySQL if quoted or just used.
                // Using backticks just in case is safer in raw queries, but here we use simple string.
                // Let's use backticks in the query construction.
                await sequelize.query(`ALTER TABLE DailyPrices ADD COLUMN \`${col.name}\` ${col.type};`);
                console.log(`  ✅ Columna agregada: ${col.name}`);
            } catch (error) {
                if (error.original && error.original.code === 'ER_DUP_FIELDNAME') {
                    console.log(`  ℹ️ La columna ${col.name} ya existe.`);
                } else {
                    console.error(`  ❌ Error agregando ${col.name}:`, error.message);
                }
            }
        }

        console.log('\n✅ Migración completada.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error fatal en migración:', error);
        process.exit(1);
    }
};

runMigration();
