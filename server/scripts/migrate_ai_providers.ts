import { initDatabase } from '../init_db';

console.log('Starting migration for AI Providers...');
await initDatabase();
console.log('Migration completed.');
process.exit(0);
