
import { DiscoveryJob } from '../jobs/discoveryJob';
import { SettingsService } from '../services/settingsService';
import { initDatabase } from '../init_db';

// Force Enable Crawler for this run
async function runManual() {
    console.log('--- Manual Crawler Trigger ---');
    await initDatabase();

    try {
        console.log('Ejecutando scanHybridPair()...');
        await DiscoveryJob.scanHybridPair();
        console.log('Hecho.');
    } catch (e) {
        console.error('Error:', e);
    }
}

runManual();
