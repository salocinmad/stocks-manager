import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Cargar credenciales de la base de datos desde /run/secrets/db_credentials si existen
const dbCredentialsPath = '/run/secrets/db_credentials';
if (fs.existsSync(dbCredentialsPath)) {
  dotenv.config({ path: dbCredentialsPath });
}

const dbName = process.env.DB_NAME || process.env.MYSQL_DATABASE || 'portfolio_manager';
const dbUser = process.env.DB_USER || process.env.MYSQL_USER || 'user';
const dbPass = process.env.DB_PASS || process.env.MYSQL_PASSWORD || 'password';
const dbHost = process.env.DB_HOST || 'mariadb';
const dbPort = Number(process.env.DB_PORT || 3306);

const sequelize = new Sequelize(dbName, dbUser, dbPass, {
  host: dbHost,
  port: dbPort,
  dialect: 'mysql',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado a MariaDB correctamente');

    // Registrar todos los modelos ANTES de sincronizar (evitar FKs mal formadas)
    await Promise.all([
      import('../models/User.js'),
      import('../models/Portfolio.js'),
      import('../models/Operation.js'),
      import('../models/PriceCache.js'),
      import('../models/DailyPrice.js'),
      import('../models/DailyPortfolioStats.js'),
      import('../models/DailyPositionSnapshot.js'),
      import('../models/Note.js'),
      import('../models/PositionOrder.js'),
      import('../models/ProfilePicture.js'),
      import('../models/GlobalCurrentPrice.js'),
      import('../models/GlobalStockPrice.js'),
      import('../models/UserStockAlert.js'),

      import('../models/Config.js'),
      import('../models/ExternalLinkButton.js'),
      import('../models/PortfolioReport.js'),
      import('../models/AssetProfile.js'),
    ])

    const alter = process.env.DB_SYNC_ALTER === 'true' || process.env.NODE_ENV === 'development'
    await sequelize.sync({ alter });
    console.log('✅ Modelos sincronizados');



    try {
      const [rows2] = await sequelize.query("SHOW INDEX FROM `DailyPrices`")
      const byKey2 = new Map()
      for (const r of (rows2 || [])) {
        const key = String(r.Key_name)
        const arr = byKey2.get(key) || []
        arr.push(r)
        byKey2.set(key, arr)
      }
      for (const [key, arr] of byKey2.entries()) {
        const unique = arr[0]?.Non_unique === 0
        if (!unique) continue
        const cols = new Set(arr.map(x => String(x.Column_name).toLowerCase()))
        if (cols.has('userid') && cols.has('positionkey') && cols.has('date') && !cols.has('portfolioid')) {
          await sequelize.query(`ALTER TABLE \`DailyPrices\` DROP INDEX \`${key}\``)
        }
      }
      await sequelize.query('ALTER TABLE `DailyPrices` ADD UNIQUE INDEX `dp_user_portfolio_pos_date` (`userId`,`portfolioId`,`positionKey`,`date`)')
    } catch (e) { }

    try {
      const [rowsU] = await sequelize.query("SHOW INDEX FROM `Users`")
      const uniqUsername = (rowsU || []).filter(r => r.Non_unique === 0 && String(r.Column_name).toLowerCase() === 'username')
      if (uniqUsername.length > 1) {
        for (let i = 1; i < uniqUsername.length; i++) {
          const k = String(uniqUsername[i].Key_name)
          await sequelize.query(`ALTER TABLE \`Users\` DROP INDEX \`${k}\``)
        }
      }
      const hasNamed = (rowsU || []).some(r => String(r.Key_name) === 'users_username_unique')
      if (!hasNamed) {
        await sequelize.query('ALTER TABLE `Users` ADD UNIQUE INDEX `users_username_unique` (`username`)')
      }
    } catch (e) { }
  } catch (error) {
    console.error('❌ Error al conectar con MariaDB:', error);
    process.exit(1);
  }
};

export default sequelize;
