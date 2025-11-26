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

    // Migración: backfill de portfolioId y creación de portafolios por defecto
    try {
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
      console.log('✅ Migración de múltiples portafolios aplicada')
    } catch (mErr) {
      console.log('⚠️ Migración de múltiples portafolios omitida:', mErr.message)
    }
  } catch (error) {
    console.error('❌ Error conectando a MariaDB:', error);
    process.exit(1);
  }
};

export default sequelize;
