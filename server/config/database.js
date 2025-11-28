import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'portfolio_manager',
  process.env.DB_USER || 'user',
  process.env.DB_PASS || 'password',
  {
    host: process.env.DB_HOST || 'mariadb',
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

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
    ])

    // Pre-migración: asegurar columnas portfolioId antes de que Sequelize intente crear índices
    try {
      const ensureColumn = async (table) => {
        const [cols] = await sequelize.query(`SHOW COLUMNS FROM \`${table}\` LIKE 'portfolioId'`)
        if (!Array.isArray(cols) || cols.length === 0) {
          await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`portfolioId\` INT NULL`)
        }
      }
      await ensureColumn('PriceCaches')
      await ensureColumn('DailyPrices')
      await ensureColumn('DailyPortfolioStats')

      // Asegurar columnas para botones externos en Operations
      const ensureExternalSymbols = async () => {
        const table = 'Operations';
        for (let i = 1; i <= 3; i++) {
          const colName = `externalSymbol${i}`;
          const [cols] = await sequelize.query(`SHOW COLUMNS FROM \`${table}\` LIKE '${colName}'`);
          if (!Array.isArray(cols) || cols.length === 0) {
            console.log(`🔧 Agregando columna ${colName} a ${table}...`);
            await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${colName}\` VARCHAR(100) NULL DEFAULT NULL`);
          }
        }
      };
      await ensureExternalSymbols();
    } catch (e) {
      console.error('Error en pre-migración de columnas:', e);
    }

    const alter = process.env.DB_SYNC_ALTER === 'true' || process.env.NODE_ENV === 'development'
    await sequelize.sync({ alter });
    console.log('✅ Modelos sincronizados');

    try {
      const { default: Config } = await import('../models/Config.js')
      const flag = await Config.findOne({ where: { key: 'migration_multi_portfolios_done' } })
      if (!flag) {
        const { default: User } = await import('../models/User.js')
        const { default: Portfolio } = await import('../models/Portfolio.js')
        const { default: Operation } = await import('../models/Operation.js')
        const { default: PriceCache } = await import('../models/PriceCache.js')
        const { default: DailyPrice } = await import('../models/DailyPrice.js')
        const { default: DailyPortfolioStats } = await import('../models/DailyPortfolioStats.js')
        const { default: Note } = await import('../models/Note.js')
        const { default: PositionOrder } = await import('../models/PositionOrder.js')

        const users = await User.findAll()
        for (const u of users) {
          const userId = u.id
          let p = await Portfolio.findOne({ where: { userId }, order: [['id', 'ASC']] })
          if (!p) {
            p = await Portfolio.create({ userId, name: 'Principal' })
            await User.update({ favoritePortfolioId: p.id }, { where: { id: userId } })
          } else if (!u.favoritePortfolioId) {
            await User.update({ favoritePortfolioId: p.id }, { where: { id: userId } })
          }
          const portfolioId = p.id
          const tables = [Operation, PriceCache, DailyPrice, DailyPortfolioStats, Note, PositionOrder]
          for (const model of tables) {
            await model.update({ portfolioId }, { where: { userId, portfolioId: null } })
          }
        }

        await Config.create({ key: 'migration_multi_portfolios_done', value: 'true' })
      }
    } catch (mErr) { }

    try {
      const [idx] = await sequelize.query("SHOW INDEX FROM `PriceCaches` WHERE Key_name='price_caches_user_id_position_key'")
      if (Array.isArray(idx) && idx.length > 0) {
        await sequelize.query('ALTER TABLE `PriceCaches` DROP INDEX `price_caches_user_id_position_key`')
        await sequelize.query('ALTER TABLE `PriceCaches` ADD UNIQUE INDEX `price_caches_user_portfolio_position` (`userId`,`portfolioId`,`positionKey`)')

      }
    } catch (e) {
      // índice ya correcto o no aplicable
    }

    // Ajuste robusto de índice único en DailyPortfolioStats
    try {
      const [rows] = await sequelize.query("SHOW INDEX FROM `DailyPortfolioStats`")
      const byKey = new Map()
      for (const r of (rows || [])) {
        const key = String(r.Key_name)
        const arr = byKey.get(key) || []
        arr.push(r)
        byKey.set(key, arr)
      }
      for (const [key, arr] of byKey.entries()) {
        const unique = arr[0]?.Non_unique === 0
        if (!unique) continue
        const cols = new Set(arr.map(x => String(x.Column_name).toLowerCase()))
        if (cols.has('userid') && cols.has('date') && !cols.has('portfolioid')) {
          await sequelize.query(`ALTER TABLE \`DailyPortfolioStats\` DROP INDEX \`${key}\``)
        }
      }
      await sequelize.query('ALTER TABLE `DailyPortfolioStats` ADD UNIQUE INDEX `dps_user_portfolio_date` (`userId`,`portfolioId`,`date`)')

    } catch (e) { }

    // Ajuste robusto de índice único en DailyPrices
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
    console.error('❌ Error conectando a MariaDB:', error);
    process.exit(1);
  }
};

export default sequelize;
