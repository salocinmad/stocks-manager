import sequelize from './config/database.js';
import Operation from './models/Operation.js';
import DailyPrice from './models/DailyPrice.js';
import User from './models/User.js';
import Portfolio from './models/Portfolio.js';
import { Op } from 'sequelize';

async function test() {
    try {
        console.log('Authenticating...');
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        // Parámetros de prueba
        const userId = 1; // Asumiendo que existe el usuario ID 1
        const positionKey = 'AMD'; // Basado en captura de pantalla
        const decodedPositionKey = positionKey;
        const searchSymbol = 'AMD';

        // Get a portfolio
        const portfolio = await Portfolio.findOne({ where: { userId } });
        const portfolioId = portfolio ? portfolio.id : null;
        console.log(`Using Portfolio ID: ${portfolioId}`);

        console.log('Fetching Operations...');
        const operations = await Operation.findAll({
            where: {
                userId,
                portfolioId,
                [Op.or]: [
                    { symbol: decodedPositionKey },
                    { symbol: searchSymbol },
                    { company: decodedPositionKey }
                ]
            },
            attributes: ['id', 'type', 'date', 'price', 'shares'],
            order: [['date', 'ASC']]
        });
        console.log(`Found ${operations.length} operations.`);
        console.log(JSON.stringify(operations, null, 2));

        console.log('Fetching History...');
        const historicalData = await DailyPrice.findAll({
            where: {
                userId,
                portfolioId,
                positionKey: decodedPositionKey,
                date: { [Op.gte]: '2024-01-01' }
            },
            attributes: ['date', 'open', 'high', 'low', 'close'],
            order: [['date', 'ASC']],
            limit: 5
        });
        console.log(`Found ${historicalData.length} history records.`);

    } catch (error) {
        console.error('ERROR:', error);
    } finally {
        await sequelize.close();
    }
}

test();
