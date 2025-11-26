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
      import('../models/Note.js'),
      import('../models/PositionOrder.js'),
      import('../models/ProfilePicture.js'),
    ])

    // Sincronizar modelos, alterando tablas existentes para que coincidan con los modelos
    await sequelize.sync({ alter: true });
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
        console.log('✅ Migración de múltiples portafolios aplicada')
      }
    } catch (mErr) {
      console.log('⚠️ Migración de múltiples portafolios omitida:', mErr.message)
    }

    try {
      const [idx] = await sequelize.query("SHOW INDEX FROM `PriceCaches` WHERE Key_name='price_caches_user_id_position_key'")
      if (Array.isArray(idx) && idx.length > 0) {
        await sequelize.query('ALTER TABLE `PriceCaches` DROP INDEX `price_caches_user_id_position_key`')
        await sequelize.query('ALTER TABLE `PriceCaches` ADD UNIQUE INDEX `price_caches_user_portfolio_position` (`userId`,`portfolioId`,`positionKey`)')
        console.log('✅ Índice único de PriceCaches actualizado a (userId, portfolioId, positionKey)')
      }
    } catch (e) {
      // índice ya correcto o no aplicable
    }

    // Ajuste de índice único en DailyPortfolioStats
    try {
      const [idx2] = await sequelize.query("SHOW INDEX FROM `DailyPortfolioStats` WHERE Non_unique=0")
      const hasOld = Array.isArray(idx2) && idx2.some(r => String(r.Column_name).toLowerCase() === 'userid' && String(r.Key_name).toLowerCase().includes('user') && String(r.Column_name).toLowerCase() === 'userid')
      // Drop cualquier índice único sencillo potencial antiguo sobre (userId,date)
      for (const r of (idx2 || [])) {
        if (String(r.Key_name).toLowerCase().includes('userid') && String(r.Key_name).toLowerCase().includes('date') && !String(r.Key_name).toLowerCase().includes('portfolioid')) {
          await sequelize.query(`ALTER TABLE \`DailyPortfolioStats\` DROP INDEX \`${r.Key_name}\``)
        }
      }
      // Crear el índice correcto (idempotente: si existe, MySQL fallará silenciosamente si nombre coincide; usamos nombre nuevo)
      await sequelize.query('ALTER TABLE `DailyPortfolioStats` ADD UNIQUE INDEX `dps_user_portfolio_date` (`userId`,`portfolioId`,`date`)')
      console.log('✅ Índice único de DailyPortfolioStats actualizado a (userId, portfolioId, date)')
    } catch (e) {
      // índice ya correcto o no aplicable
    }

    // Ajuste de índice único en DailyPrices
    try {
      const [idx3] = await sequelize.query("SHOW INDEX FROM `DailyPrices` WHERE Non_unique=0")
      for (const r of (idx3 || [])) {
        const key = String(r.Key_name).toLowerCase()
        if (key.includes('userid') && key.includes('position') && key.includes('date') && !key.includes('portfolioid')) {
          await sequelize.query(`ALTER TABLE \`DailyPrices\` DROP INDEX \`${r.Key_name}\``)
        }
      }
      await sequelize.query('ALTER TABLE `DailyPrices` ADD UNIQUE INDEX `dp_user_portfolio_pos_date` (`userId`,`portfolioId`,`positionKey`,`date`)')
      console.log('✅ Índice único de DailyPrices actualizado a (userId, portfolioId, positionKey, date)')
    } catch (e) {
      // índice ya correcto o no aplicable
    }
  } catch (error) {
    console.error('❌ Error conectando a MariaDB:', error);
    process.exit(1);
  }
};

export default sequelize;
