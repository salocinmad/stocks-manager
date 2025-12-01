
import DailyPrice from './server/models/DailyPrice.js';
import Operation from './server/models/Operation.js';
import sequelize from './server/config/database.js';

async function checkData() {
    try {
        const prices = await DailyPrice.findAll({ limit: 5, order: [['date', 'DESC']] });
        console.log('Recent DailyPrices:', JSON.stringify(prices, null, 2));

        const ops = await Operation.findAll({ limit: 5 });
        console.log('Recent Operations:', JSON.stringify(ops, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await sequelize.close();
    }
}

checkData();
