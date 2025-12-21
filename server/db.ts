import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL || 'postgres://admin:securepassword@localhost:5432/stocks_manager', {
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    transform: {
        undefined: null
    }
});

export default sql;
