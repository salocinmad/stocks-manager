import { initDatabase } from '../init_db';

console.log('Running manual migration...');
await initDatabase();
console.log('Migration complete.');
process.exit(0);
