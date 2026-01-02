
import { DiscoveryJob } from '../jobs/discoveryJob';

console.log('--- Triggering Discovery Cycle Manually ---');
DiscoveryJob.runDiscoveryCycle()
    .then(() => {
        console.log('✅ Discovery Cycle Completed');
        process.exit(0);
    })
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    });
