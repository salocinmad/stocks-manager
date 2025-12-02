import Config from '../models/Config.js';

const LOG_LEVEL_KEY = 'logLevel';

export async function getLogLevel() {
    const config = await Config.findOne({ where: { key: LOG_LEVEL_KEY } });
    return config ? config.value : 'minimal'; // Por defecto log mínimo
}

export async function setLogLevel(level) {
    const [config, created] = await Config.findOrCreate({
        where: { key: LOG_LEVEL_KEY },
        defaults: { value: level }
    });

    if (!created) {
        config.value = level;
        await config.save();
    }
    return config.value;
}

export default {
    getLogLevel,
    setLogLevel
};
