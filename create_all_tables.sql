SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE `Configs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `key` varchar(255) NOT NULL,
  `value` text DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

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
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

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
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;
