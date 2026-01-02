
import { DiscoveryJob } from '../jobs/discoveryJob';
import { SettingsService } from '../services/settingsService';
import { initDatabase } from '../init_db';

// Force Enable Crawler for this run
async function runManual() {
    console.log('--- Manual Crawler Trigger ---');
    await initDatabase();
    await SettingsService.loadToEnv();

    // Mock SettingsService.get to always return true for this script
    // Or just rely on it being enabled? User might have it disabled.
    // We should probably bypass the check in the script or temporarily enable it.
    // But scanHybridPair references SettingsService.get('CRAWLER_ENABLED').
    // We can just set it:
    await SettingsService.set('CRAWLER_ENABLED', 'true');
    console.log('Forced CRAWLER_ENABLED = true for test');

    try {
        console.log('Running scanHybridPair()...');
        await DiscoveryJob.scanHybridPair();
        console.log('Done.');
    } catch (e) {
        console.error('Error:', e);
    }
}

runManual();
