import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL || 'postgres://admin:securepassword@localhost:5432/stocks_manager', {
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    transform: {
        undefined: null
    },
    // Suppress PostgreSQL NOTICE messages (e.g., "relation already exists, skipping")
    onnotice: () => { } // Silent - prevents verbose "already exists" messages during migrations
});

export default sql;

