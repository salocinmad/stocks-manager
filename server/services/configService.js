

import { eq } from 'drizzle-orm';

const LOG_LEVEL_KEY = 'logLevel';

export async function getLogLevel(db, eq, schema) {
    try {
        console.log('DEBUG: db in getLogLevel:', db);
        console.log('DEBUG: eq is available:', typeof eq === 'function');
        console.log('DEBUG: Value of eq:', eq);
        console.log('DEBUG: schema in getLogLevel:', schema);
        console.log('DEBUG: schema.configs.key is available:', !!schema.configs.key);
        const config = await db.query.configs.findFirst({ where: eq(schema.configs.key, LOG_LEVEL_KEY) });
        return config ? config.value : 'minimal'; // Por defecto log mínimo
    } catch (error) {
        console.error('Error in getLogLevel Drizzle query:', error);
        throw error;
    }
}

export async function setLogLevel(db, level, schema) {
    await db.insert(schema.configs)
      .values({ key: LOG_LEVEL_KEY, value: level })
      .onConflictDoUpdate({
        target: schema.configs.key,
        set: { value: level }
      });
    return level;
}

export default {
    getLogLevel,
    setLogLevel
};
