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
      import('../models/PriceCache.js'),  // Legacy - mantener para migración
      import('../models/DailyPrice.js'),  // Legacy - mantener para migración
      import('../models/DailyPortfolioStats.js'),
      import('../models/DailyPositionSnapshot.js'),
      import('../models/Note.js'),
      import('../models/PositionOrder.js'),
      import('../models/ProfilePicture.js'),
      // NUEVOS MODELOS GLOBALES
      import('../models/GlobalCurrentPrice.js'),
      import('../models/GlobalStockPrice.js'),
      import('../models/UserStockAlert.js'),
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

      // Pre-migración: asegurar columnas para datos históricos mejorados
      const ensureEnhancedDataColumns = async () => {
        // DailyPortfolioStats
        const statsCols = [
          { name: 'dailyChangeEUR', type: 'FLOAT NULL DEFAULT NULL' },
          { name: 'dailyChangePercent', type: 'FLOAT NULL DEFAULT NULL' },
          { name: 'roi', type: 'FLOAT NULL DEFAULT NULL' },
          { name: 'activePositionsCount', type: 'INT NULL DEFAULT 0' },
          { name: 'closedOperationsCount', type: 'INT NULL DEFAULT 0' }
        ];
        for (const col of statsCols) {
          const [cols] = await sequelize.query(`SHOW COLUMNS FROM \`DailyPortfolioStats\` LIKE '${col.name}'`);
          if (!Array.isArray(cols) || cols.length === 0) {
            console.log(`🔧 Agregando columna ${col.name} a DailyPortfolioStats...`);
            await sequelize.query(`ALTER TABLE \`DailyPortfolioStats\` ADD COLUMN \`${col.name}\` ${col.type}`);
          }
        }

        // DailyPrices
        const priceCols = [
          { name: 'change', type: 'FLOAT NULL DEFAULT NULL' },
          { name: 'changePercent', type: 'FLOAT NULL DEFAULT NULL' },
          { name: 'open', type: 'FLOAT NULL DEFAULT NULL' },
          { name: 'high', type: 'FLOAT NULL DEFAULT NULL' },
          { name: 'low', type: 'FLOAT NULL DEFAULT NULL' },
          { name: 'shares', type: 'FLOAT NULL DEFAULT NULL' }
        ];
        for (const col of priceCols) {
          const [cols] = await sequelize.query(`SHOW COLUMNS FROM \`DailyPrices\` LIKE '${col.name}'`);
          if (!Array.isArray(cols) || cols.length === 0) {
            console.log(`🔧 Agregando columna ${col.name} a DailyPrices...`);
            await sequelize.query(`ALTER TABLE \`DailyPrices\` ADD COLUMN \`${col.name}\` ${col.type}`);
          }
        }
      };
      await ensureEnhancedDataColumns();
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

    // Migración automática a tablas globales de precios
    try {
      const { default: Config } = await import('../models/Config.js')
      const flag = await Config.findOne({ where: { key: 'migration_global_tables_done' } })

      if (!flag) {
        console.log('\n🔄 Ejecutando migración a tablas globales...')

        // Importar script de migración
        const migrateToGlobal = await import('../scripts/migrateToGlobal.js')
        const migrationFn = migrateToGlobal.default

        try {
          const stats = await migrationFn()
          console.log(`✅ Migración global completada:`)
          console.log(`   - GlobalCurrentPrices: ${stats.currentPrices}`)
          console.log(`   - GlobalStockPrices: ${stats.historicalPrices}`)
          console.log(`   - UserStockAlerts: ${stats.alerts}`)

          // Marcar como completada
          await Config.create({ key: 'migration_global_tables_done', value: 'true' })
        } catch (migErr) {
          console.error('⚠️  Error en migración global (continuando):', migErr.message)
          // No bloqueamos el arranque si falla
        }
      }
    } catch (mErr) {
      console.error('⚠️  Verificación de migración global fallida:', mErr.message)
    }

    try {
      const { default: ExternalLinkButton } = await import('../models/ExternalLinkButton.js')
      const { default: Config } = await import('../models/Config.js')
      const flag = await Config.findOne({ where: { key: 'default_buttons_created' } })
      if (!flag) {
        await ExternalLinkButton.bulkCreate([
          { label: 'Google Finance', url: 'https://www.google.com/finance/quote/{symbol}', color: '#4285F4', icon: '📈', displayOrder: 1 },
          { label: 'Yahoo Finance', url: 'https://finance.yahoo.com/quote/{symbol}', color: '#720E9E', icon: '💹', displayOrder: 2 },
          { label: 'MarketWatch', url: 'https://www.marketwatch.com/investing/stock/{symbol}', color: '#00AC4E', icon: '📊', displayOrder: 3 }
        ])
        await Config.create({ key: 'default_buttons_created', value: 'true' })
      }
    } catch (e) { }

    try {
      const { default: Config } = await import('../models/Config.js')
      const { default: PortfolioReport } = await import('../models/PortfolioReport.js')
      const flag = await Config.findOne({ where: { key: 'migration_portfolio_reports_done' } })
      if (!flag) {
        const { default: Portfolio } = await import('../models/Portfolio.js')
        const { default: DailyPortfolioStats } = await import('../models/DailyPortfolioStats.js')

        const portfolios = await Portfolio.findAll()
        for (const p of portfolios) {
          const lastStats = await DailyPortfolioStats.findOne({
            where: { userId: p.userId, portfolioId: p.id },
            order: [['date', 'DESC']],
            limit: 1
          })
          if (lastStats) {
            await PortfolioReport.upsert({
              userId: p.userId,
              portfolioId: p.id,
              date: lastStats.date,
              totalValueEUR: lastStats.pnlEUR || 0,
              pnlEUR: lastStats.pnlEUR || 0,
              dailyChangeEUR: lastStats.dailyChangeEUR || 0,
              activePositionsCount: lastStats.activePositionsCount || 0
            })
          }
        }
        await Config.create({ key: 'migration_portfolio_reports_done', value: 'true' })
      }
    } catch (e) { }
  } catch (error) {
    console.error('❌ Error al conectar con MariaDB:', error);
    process.exit(1);
  }
};

export default sequelize;
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
