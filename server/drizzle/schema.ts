import { 
  pgTable, 
  serial, 
  varchar, 
  integer, 
  bigint, 
  real,
  numeric,
  timestamp,
  date,
  boolean,
  text,
  pgEnum,
  jsonb,
  uniqueIndex,
  index 
} from 'drizzle-orm/pg-core';
import { relations, InferSelectModel } from 'drizzle-orm';

// Enums
export const operationTypeEnum = pgEnum('operation_type', ['purchase', 'sale']);

// Tablas principales
export const users = pgTable('Users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  isAdmin: boolean('isAdmin').default(false),
  favoritePortfolioId: integer('favoritePortfolioId'),
  twoFactorSecret: varchar('twoFactorSecret', { length: 255 }),
  twoFactorTempSecret: varchar('twoFactorTempSecret', { length: 255 }),
  isTwoFactorEnabled: boolean('isTwoFactorEnabled').default(false),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => ({
  usersUsernameUnique: uniqueIndex('users_username_unique').on(table.username),
}));

export const portfolios = pgTable('Portfolios', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const operations = pgTable('Operations', {
  id: serial('id').primaryKey(),
  type: operationTypeEnum('type').notNull(),
  company: varchar('company', { length: 255 }).notNull(),
  symbol: varchar('symbol', { length: 255 }).default(''),
  shares: real('shares').notNull(),
  price: real('price').notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('EUR'),
  exchangeRate: numeric('exchangeRate', { precision: 18, scale: 12 }).notNull().default('1'),
  commission: real('commission').default(0),
  totalCost: real('totalCost').notNull(),
  targetPrice: real('targetPrice'),
  date: timestamp('date').defaultNow().notNull(),
  portfolioId: integer('portfolioId').references(() => portfolios.id, { onDelete: 'cascade' }),
  externalSymbol1: varchar('externalSymbol1', { length: 100 }),
  externalSymbol2: varchar('externalSymbol2', { length: 100 }),
  externalSymbol3: varchar('externalSymbol3', { length: 100 }),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const dailyPrices = pgTable('DailyPrices', {
  id: serial('id').primaryKey(),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  positionKey: varchar('positionKey', { length: 255 }).notNull(),
  company: varchar('company', { length: 255 }).notNull(),
  symbol: varchar('symbol', { length: 255 }),
  portfolioId: integer('portfolioId').references(() => portfolios.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  close: real('close').notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('EUR'),
  exchangeRate: real('exchangeRate').notNull().default(1),
  source: varchar('source', { length: 50 }).default('yahoo'),
  change: real('change'),
  changePercent: real('changePercent'),
  open: real('open'),
  high: real('high'),
  low: real('low'),
  volume: bigint('volume', { mode: 'number' }),
  shares: real('shares'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => ({
  dpUserPortfolioPosDate: uniqueIndex('dp_user_portfolio_pos_date').on(table.userId, table.portfolioId, table.positionKey, table.date),
  dailyPricesUserIdx: index('dailyprices_user_idx').on(table.userId),
  dailyPricesDateIdx: index('dailyprices_date_idx').on(table.date),
}));

export const dailyPortfolioStats = pgTable('DailyPortfolioStats', {
  id: serial('id').primaryKey(),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  portfolioId: integer('portfolioId').references(() => portfolios.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  totalInvestedEur: real('totalInvestedEUR').notNull().default(0),
  totalValueEur: real('totalValueEUR').notNull().default(0),
  pnlEur: real('pnlEUR').notNull().default(0),
  dailyChangeEur: real('dailyChangeEUR'),
  dailyChangePercent: real('dailyChangePercent'),
  roi: real('roi'),
  activePositionsCount: integer('activePositionsCount').default(0),
  closedOperationsCount: integer('closedOperationsCount').default(0),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => ({
  dpsUserPortfolioDate: uniqueIndex('dps_user_portfolio_date').on(table.userId, table.portfolioId, table.date),
  dpsStatsDateIdx: index('dps_stats_date_idx').on(table.date),
}));

export const configs = pgTable('Configs', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 255 }).notNull().unique(),
  value: text('value').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const notes = pgTable('Notes', {
  id: serial('id').primaryKey(),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  portfolioId: integer('portfolioId').references(() => portfolios.id, { onDelete: 'cascade' }),
  positionKey: varchar('positionKey', { length: 255 }).notNull(),
  content: text('content').notNull().default(''),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => ({
  notesUserPortfolioPos: uniqueIndex('notes_user_portfolio_pos').on(table.userId, table.portfolioId, table.positionKey),
  notesUserIdx: index('notes_user_idx').on(table.userId),
}));

export const positionOrders = pgTable('PositionOrders', {
  id: serial('id').primaryKey(),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  portfolioId: integer('portfolioId').references(() => portfolios.id, { onDelete: 'cascade' }),
  positionKey: varchar('positionKey', { length: 255 }).notNull(),
  displayOrder: integer('displayOrder').notNull().default(0),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => ({
  poUserPortfolioPos: uniqueIndex('po_user_portfolio_pos').on(table.userId, table.portfolioId, table.positionKey),
  poUserIdx: index('po_user_idx').on(table.userId),
}));

export const priceCaches = pgTable('PriceCaches', {
  id: serial('id').primaryKey(),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  positionKey: varchar('positionKey', { length: 255 }).notNull(),
  portfolioId: integer('portfolioId').references(() => portfolios.id, { onDelete: 'cascade' }),
  lastPrice: real('lastPrice').notNull(),
  change: real('change'),
  changePercent: real('changePercent'),
  source: varchar('source', { length: 50 }),
  targetHitNotifiedAt: timestamp('targetHitNotifiedAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => ({
  pcUserPortfolioPos: uniqueIndex('pc_user_portfolio_pos').on(table.userId, table.portfolioId, table.positionKey),
  pcUserIdx: index('pc_user_idx').on(table.userId),
}));

export const profilePictures = pgTable('ProfilePictures', {
  id: serial('id').primaryKey(),
  userId: integer('userId').notNull().unique().references(() => users.id),
  filename: varchar('filename', { length: 255 }).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const assetProfiles = pgTable('AssetProfiles', {
  symbol: varchar('symbol', { length: 50 }).primaryKey(),
  sector: varchar('sector', { length: 255 }),
  industry: varchar('industry', { length: 255 }),
  beta: real('beta'),
  dividendYield: real('dividendYield'),
  marketCap: bigint('marketCap', { mode: 'number' }),
  currency: varchar('currency', { length: 10 }),
  description: text('description'),
  website: varchar('website', { length: 500 }),
  logoUrl: varchar('logoUrl', { length: 500 }),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export const dailyPositionSnapshots = pgTable('DailyPositionSnapshots', {
  id: serial('id').primaryKey(),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  portfolioId: integer('portfolioId').notNull().references(() => portfolios.id, { onDelete: 'cascade' }),
  positionKey: varchar('positionKey', { length: 255 }).notNull(),
  company: varchar('company', { length: 255 }).notNull(),
  symbol: varchar('symbol', { length: 255 }).default(''),
  date: date('date').notNull(),
  shares: real('shares').notNull(),
  avgCost: real('avgCost').notNull(),
  totalInvested: real('totalInvested').notNull(),
  currentPrice: real('currentPrice').notNull(),
  totalValue: real('totalValue').notNull(),
  pnl: real('pnl').notNull(),
  pnlPercent: real('pnlPercent').notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('EUR'),
  exchangeRate: real('exchangeRate').notNull().default(1),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => ({
  dpsUserPortfolioPosDate: uniqueIndex('dps_user_portfolio_pos_date').on(table.userId, table.portfolioId, table.positionKey, table.date),
  dpsUserIdx: index('dps_user_idx').on(table.userId),
  dpsPortfolioIdx: index('dps_portfolio_idx').on(table.portfolioId),
  dpsDateIdx: index('dps_date_idx').on(table.date),
}));

export const externalLinkButtons = pgTable('ExternalLinkButtons', {
  id: serial('id').primaryKey(),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 20 }).notNull(),
  baseUrl: varchar('baseUrl', { length: 500 }).notNull(),
  imageUrl: varchar('imageUrl', { length: 500 }).notNull(),
  displayOrder: integer('displayOrder').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => ({
  elbUserDisplayOrder: uniqueIndex('elb_user_display_order').on(table.userId, table.displayOrder),
}));

export const globalCurrentPrices = pgTable('GlobalCurrentPrices', {
  symbol: varchar('symbol', { length: 50 }).primaryKey(),
  lastPrice: real('lastPrice').notNull(),
  change: real('change'),
  changePercent: real('changePercent'),
  open: real('open'),
  high: real('high'),
  low: real('low'),
  previousClose: real('previousClose'),
  previousCloseDate: date('previousCloseDate'),
  volume: bigint('volume', { mode: 'number' }),
  marketState: varchar('marketState', { length: 50 }),
  currency: varchar('currency', { length: 10 }),
  exchange: varchar('exchange', { length: 50 }),
  regularMarketTime: timestamp('regularMarketTime'),
  source: varchar('source', { length: 50 }).notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
}, (table) => ({
  gcpSymbolUnique: uniqueIndex('gcp_symbol_unique').on(table.symbol),
  gcpUpdatedAtIdx: index('gcp_updated_at_idx').on(table.updatedAt),
}));

export const globalStockPrices = pgTable('GlobalStockPrices', {
  id: serial('id').primaryKey(),
  symbol: varchar('symbol', { length: 50 }).notNull(),
  date: date('date').notNull(),
  open: real('open'),
  high: real('high'),
  low: real('low'),
  close: real('close').notNull(),
  volume: bigint('volume', { mode: 'number' }),
  change: real('change'),
  changePercent: real('changePercent'),
  adjClose: real('adjClose'),
  source: varchar('source', { length: 50 }).default('yahoo'),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
}, (table) => ({
  gspSymbolDate: uniqueIndex('gsp_symbol_date').on(table.symbol, table.date),
  gspSymbolIdx: index('gsp_symbol_idx').on(table.symbol),
  gspDateIdx: index('gsp_date_idx').on(table.date),
}));

export const userStockAlerts = pgTable('UserStockAlerts', {
  id: serial('id').primaryKey(),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  portfolioId: integer('portfolioId').references(() => portfolios.id, { onDelete: 'cascade' }),
  symbol: varchar('symbol', { length: 50 }).notNull(),
  targetPrice: real('targetPrice'),
  targetHitNotifiedAt: timestamp('targetHitNotifiedAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => ({
  usaUserPortfolioSymbol: uniqueIndex('usa_user_portfolio_symbol').on(table.userId, table.portfolioId, table.symbol),
  usaUserIdx: index('usa_user_idx').on(table.userId),
  usaSymbolIdx: index('usa_symbol_idx').on(table.symbol),
}));

// Relations (para type-safety en queries)
export const usersRelations = relations(users, ({ many }) => ({
  portfolios: many(portfolios),
  operations: many(operations),
  // ... más según necesites
}));

export const portfoliosRelations = relations(portfolios, ({ one, many }) => ({
  user: one(users, {
    fields: [portfolios.userId],
    references: [users.id],
  }),
  operations: many(operations),
  // ...
}));

// Exporta types para queries
export type User = InferSelectModel<typeof users>;
export type Portfolio = InferSelectModel<typeof portfolios>;
// Agrega más types según necesites
