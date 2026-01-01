
import sql from '../db';

const run = async () => {
    try {
        console.log('--- DATA STATUS ---');
        const users = await sql`SELECT count(*) FROM users`;
        const portfolios = await sql`SELECT count(*) FROM portfolios`;
        const positions = await sql`SELECT count(*) FROM positions`;
        const transactions = await sql`SELECT count(*) FROM transactions`;

        console.log(`Users: ${users[0].count}`);
        console.log(`Portfolios: ${portfolios[0].count}`);
        console.log(`Positions: ${positions[0].count}`);
        console.log(`Transactions: ${transactions[0].count}`);

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
};

run();
