

const LOG_LEVEL_KEY = 'logLevel';

export async function getLogLevel() {
    const config = await db.query.configs.findFirst({ where: eq(schema.configs.key, LOG_LEVEL_KEY) });
    return config ? config.value : 'minimal'; // Por defecto log mínimo
}

export async function setLogLevel(level) {
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
