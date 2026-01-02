import sql from '../db';
import { CalendarService } from '../services/calendarService';

export const CalendarJob = {
    /**
     * Run the synchronization cycle for all users
     */
    async run() {
        console.log(`[CalendarJob] Starting 6h sync cycle... ${new Date().toISOString()}`);

        // Check if Discovery Crawler ran recently (within 5 minutes)
        // If so, wait until 5 minutes have passed to avoid API congestion.
        while (true) {
            try {
                const result = await sql`SELECT MAX(updated_at) as last_run FROM market_discovery_cache`;
                if (!result || result.length === 0 || !result[0].last_run) {
                    break; // No previous run, safe to proceed
                }

                const lastRun = new Date(result[0].last_run);
                const now = new Date();
                const diffMs = now.getTime() - lastRun.getTime();
                const diffMinutes = diffMs / (1000 * 60);

                if (diffMinutes >= 5) {
                    console.log(`[CalendarJob] Crawler safe time passed (${diffMinutes.toFixed(1)} mins). Proceeding.`);
                    break;
                }

                console.log(`[CalendarJob] Discovery Crawler just ran (${diffMinutes.toFixed(1)} mins ago). Waiting 2 minutes...`);
                await new Promise(resolve => setTimeout(resolve, 2 * 60 * 1000)); // Sleep 2 mins
                // Loop check again

            } catch (e: any) {
                console.error('[CalendarJob] Error checking lock:', e.message);
                break; // Proceed on error
            }
        }

        try {
            // Get all users
            const users = await sql`SELECT id FROM users`;

            console.log(`[CalendarJob] Syncing financial events for ${users.length} users...`);

            let totalSynced = 0;
            for (const user of users) {
                const count = await CalendarService.syncUserEvents(user.id);
                totalSynced += count;
            }

            console.log(`[CalendarJob] Cycle completed. Synced ${totalSynced} events across ${users.length} users.`);

        } catch (e: any) {
            console.error('[CalendarJob] Error during sync cycle:', e.message);
        }
    }
};
