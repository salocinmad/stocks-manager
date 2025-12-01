# Resumen de la Base de Datos y Tareas Realizadas

Este documento resume la información clave obtenida durante el análisis de la base de datos y las tareas realizadas hasta el momento.

## 1. Scripts de Actualización de Base de Datos

**Estado:** No se encontraron scripts de actualización de base de datos (CREATE TABLE, ALTER TABLE, migraciones) en el código base. La lógica de definición de tablas se gestiona a través del ORM Sequelize.

## 2. Tablas Identificadas y Mapeadas

Se identificaron 16 tablas a partir de los modelos de Sequelize en `i:\dev\stocks-manager\server\models\`. Estas tablas son:

- Configs
- DailyPrice
- DailyPortfolioStats
- DailyStockStats
- Exchange
- Investment
- InvestmentType
- Portfolio
- PortfolioHistory
- Stock
- StockDividend
- StockSplit
- Transaction
- User
- UserSetting
- UserStockAlert

## 3. Definiciones SQL de las Tablas

A continuación, se presentan las sentencias `CREATE TABLE` para cada una de las tablas, obtenidas directamente de la instancia de MariaDB (`portfolio_manager`) utilizando el comando Docker:

---

### `Configs`
```sql
CREATE TABLE `Configs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `key` varchar(255) NOT NULL,
  `value` text DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
```

---

### `DailyPrices`
```sql
CREATE TABLE `DailyPrices` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `stockId` int(11) NOT NULL,
  `date` date NOT NULL,
  `open` float DEFAULT NULL,
  `high` float DEFAULT NULL,
  `low` float DEFAULT NULL,
  `close` float DEFAULT NULL,
  `volume` bigint(20) DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `daily_prices_stock_id_date` (`stockId`,`date`),
  KEY `stockId` (`stockId`),
  CONSTRAINT `daily_prices_ibfk_1` FOREIGN KEY (`stockId`) REFERENCES `Stocks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
```

---

### `DailyPortfolioStats`
```sql
CREATE TABLE `DailyPortfolioStats` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `portfolioId` int(11) NOT NULL,
  `date` date NOT NULL,
  `totalValue` float NOT NULL,
  `totalInvestment` float NOT NULL,
  `totalProfit` float NOT NULL,
  `totalProfitPercentage` float NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `daily_portfolio_stats_portfolio_id_date` (`portfolioId`,`date`),
  KEY `portfolioId` (`portfolioId`),
  CONSTRAINT `daily_portfolio_stats_ibfk_1` FOREIGN KEY (`portfolioId`) REFERENCES `Portfolios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
```

---

### `DailyStockStats`
```sql
CREATE TABLE `DailyStockStats` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `stockId` int(11) NOT NULL,
  `date` date NOT NULL,
  `open` float DEFAULT NULL,
  `high` float DEFAULT NULL,
  `low` float DEFAULT NULL,
  `close` float DEFAULT NULL,
  `volume` bigint(20) DEFAULT NULL,
  `change` float DEFAULT NULL,
  `changePercent` float DEFAULT NULL,
  `avgVolume` bigint(20) DEFAULT NULL,
  `marketCap` bigint(20) DEFAULT NULL,
  `peRatio` float DEFAULT NULL,
  `dividendYield` float DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `daily_stock_stats_stock_id_date` (`stockId`,`date`),
  KEY `stockId` (`stockId`),
  CONSTRAINT `daily_stock_stats_ibfk_1` FOREIGN KEY (`stockId`) REFERENCES `Stocks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
```

---

### `Exchanges`
```sql
CREATE TABLE `Exchanges` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `acronym` varchar(255) DEFAULT NULL,
  `mic` varchar(255) DEFAULT NULL,
  `country` varchar(255) DEFAULT NULL,
  `city` varchar(255) DEFAULT NULL,
  `currency` varchar(255) DEFAULT NULL,
  `timezone` varchar(255) DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `acronym` (`acronym`),
  UNIQUE KEY `mic` (`mic`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
```

---

### `Investments`
```sql
CREATE TABLE `Investments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `portfolioId` int(11) NOT NULL,
  `stockId` int(11) NOT NULL,
  `investmentTypeId` int(11) NOT NULL,
  `shares` float NOT NULL,
  `price` float NOT NULL,
  `date` date NOT NULL,
  `fees` float DEFAULT 0,
  `notes` text DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `portfolioId` (`portfolioId`),
  KEY `stockId` (`stockId`),
  KEY `investmentTypeId` (`investmentTypeId`),
  CONSTRAINT `investments_ibfk_1` FOREIGN KEY (`portfolioId`) REFERENCES `Portfolios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `investments_ibfk_2` FOREIGN KEY (`stockId`) REFERENCES `Stocks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `investments_ibfk_3` FOREIGN KEY (`investmentTypeId`) REFERENCES `InvestmentTypes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
```

---

### `InvestmentTypes`
```sql
CREATE TABLE `InvestmentTypes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `isPurchase` tinyint(1) DEFAULT 1,
  `isSale` tinyint(1) DEFAULT 0,
  `isDividend` tinyint(1) DEFAULT 0,
  `isSplit` tinyint(1) DEFAULT 0,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
```

---

### `Portfolios`
```sql
CREATE TABLE `Portfolios` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `currency` varchar(255) NOT NULL,
  `isDefault` tinyint(1) DEFAULT 0,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `portfolios_user_id_name` (`userId`,`name`),
  KEY `userId` (`userId`),
  CONSTRAINT `portfolios_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `Users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
```

---

### `PortfolioHistories`
```sql
CREATE TABLE `PortfolioHistories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `portfolioId` int(11) NOT NULL,
  `date` date NOT NULL,
  `totalValue` float NOT NULL,
  `totalInvestment` float NOT NULL,
  `totalProfit` float NOT NULL,
  `totalProfitPercentage` float NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `portfolio_histories_portfolio_id_date` (`portfolioId`,`date`),
  KEY `portfolioId` (`portfolioId`),
  CONSTRAINT `portfolio_histories_ibfk_1` FOREIGN KEY (`portfolioId`) REFERENCES `Portfolios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
```

---

### `Stocks`
```sql
CREATE TABLE `Stocks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `symbol` varchar(255) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `exchangeId` int(11) DEFAULT NULL,
  `currency` varchar(255) DEFAULT NULL,
  `sector` varchar(255) DEFAULT NULL,
  `industry` varchar(255) DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `symbol` (`symbol`),
  KEY `exchangeId` (`exchangeId`),
  CONSTRAINT `stocks_ibfk_1` FOREIGN KEY (`exchangeId`) REFERENCES `Exchanges` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
```

---

### `StockDividends`
```sql
CREATE TABLE `StockDividends` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `stockId` int(11) NOT NULL,
  `date` date NOT NULL,
  `amount` float NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stock_dividends_stock_id_date` (`stockId`,`date`),
  KEY `stockId` (`stockId`),
  CONSTRAINT `stock_dividends_ibfk_1` FOREIGN KEY (`stockId`) REFERENCES `Stocks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
```

---

### `StockSplits`
```sql
CREATE TABLE `StockSplits` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `stockId` int(11) NOT NULL,
  `date` date NOT NULL,
  `ratio` float NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stock_splits_stock_id_date` (`stockId`,`date`),
  KEY `stockId` (`stockId`),
  CONSTRAINT `stock_splits_ibfk_1` FOREIGN KEY (`stockId`) REFERENCES `Stocks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
```

---

### `Transactions`
```sql
CREATE TABLE `Transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `portfolioId` int(11) NOT NULL,
  `stockId` int(11) NOT NULL,
  `type` enum('buy','sell','dividend','split') NOT NULL,
  `shares` float NOT NULL,
  `price` float NOT NULL,
  `date` date NOT NULL,
  `fees` float DEFAULT 0,
  `notes` text DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `portfolioId` (`portfolioId`),
  KEY `stockId` (`stockId`),
  CONSTRAINT `transactions_ibfk_1` FOREIGN KEY (`portfolioId`) REFERENCES `Portfolios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `transactions_ibfk_2` FOREIGN KEY (`stockId`) REFERENCES `Stocks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
```

---

### `Users`
```sql
CREATE TABLE `Users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
```

---

### `UserSettings`
```sql
CREATE TABLE `UserSettings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `key` varchar(255) NOT NULL,
  `value` text DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_settings_user_id_key` (`userId`,`key`),
  KEY `userId` (`userId`),
  CONSTRAINT `user_settings_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `Users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
```

---

### `UserStockAlerts`
```sql
CREATE TABLE `UserStockAlerts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `portfolioId` int(11) DEFAULT NULL,
  `symbol` varchar(255) NOT NULL COMMENT 'Símbolo para esta alerta',
  `targetPrice` float DEFAULT NULL COMMENT 'Precio objetivo para notificación',
  `targetHitNotifiedAt` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_stock_alerts_user_id_portfolio_id_symbol` (`userId`,`portfolioId`,`symbol`),
  KEY `portfolioId` (`portfolioId`),
  KEY `user_stock_alerts_user_id` (`userId`),
  KEY `user_stock_alerts_symbol` (`symbol`),
  CONSTRAINT `1` FOREIGN KEY (`userId`) REFERENCES `Users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `2` FOREIGN KEY (`portfolioId`) REFERENCES `Portfolios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
```

---

## 4. Comando Docker Utilizado

El comando utilizado para obtener las definiciones de las tablas de la instancia de MariaDB fue:

`docker compose exec mariadb mariadb -u user -ppassword -D portfolio_manager -e "SHOW CREATE TABLE <nombre_de_tabla>;"`

Este comando se ejecutó para cada una de las 16 tablas identificadas.

## 5. Validación de Tablas Antiguas

**Estado:** Se ha validado que las tablas existentes en la base de datos (`portfolio_manager`) coinciden exactamente con las tablas definidas por los modelos de Sequelize. Esto confirma que no hay tablas antiguas o no utilizadas en la instancia de MariaDB que necesiten ser descartadas.
