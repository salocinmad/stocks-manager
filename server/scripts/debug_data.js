import { connectDB } from '../config/database.js';
import User from '../models/User.js';
import Portfolio from '../models/Portfolio.js';
import Operation from '../models/Operation.js';

async function debugData() {
    try {
        await connectDB();

        console.log('\n--- USERS ---');
        const users = await User.findAll();
        users.forEach(u => console.log(`ID: ${u.id}, Username: ${u.username}`));

        console.log('\n--- PORTFOLIOS ---');
        const portfolios = await Portfolio.findAll();
        portfolios.forEach(p => console.log(`ID: ${p.id}, Name: ${p.name}, UserId: ${p.userId}`));

        console.log('\n--- OPERATIONS SUMMARY ---');
        const operations = await Operation.findAll();
        const opCounts = {};
        operations.forEach(o => {
            const key = `PF-${o.portfolioId}`;
            opCounts[key] = (opCounts[key] || 0) + 1;
        });
        console.log('Operations per Portfolio ID:', opCounts);

        process.exit(0);
    } catch (error) {
        console.error('Debug script error:', error);
        process.exit(1);
    }
}

debugData();
