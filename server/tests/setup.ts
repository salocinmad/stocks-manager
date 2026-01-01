import { afterAll, beforeAll, mock } from "bun:test";
import sql from '../db';

// Silence console logs during tests to keep output clean, 
// or mock them to verify error logging.
export const setupTests = () => {
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;

    beforeAll(() => {
        // Optional: Silence logs
        // console.log = () => {};
        // console.error = () => {};
    });

    afterAll(() => {
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
    });
};

export const setupTestEnv = async () => {
    // SAFETY CHECK: ONLY RUN IN TEST ENVIRONMENT
    if (process.env.NODE_ENV !== 'test') {
        console.warn('⚠️  SKIPPING TEST DB CLEANUP: NODE_ENV is not "test". This is for safety.');
        return;
    }

    // Clean up DB tables
    try {
        // Disabled global truncate to allow parallel testing.
        // Tests must manage their own data isolation (e.g. unique emails/IDs).
        // await sql`TRUNCATE TABLE password_resets, users, portfolios, transactions CASCADE`;
    } catch (e) {
        console.error("Error setting up test env (truncate):", e);
    }
};

export const teardownTestEnv = async () => {
    if (process.env.NODE_ENV !== 'test') return;

    // Optional cleanup
    try {
        // Avoid TRUNCATE during parallel execution as it affects other running tests.
        // Instead, we rely on beforeEach/beforeAll in individual tests to ensure a clean slate for their specific scope.
        // await sql`TRUNCATE TABLE password_resets, users, portfolios, transactions CASCADE`;
    } catch (e) {
        console.error("Error tearing down test env:", e);
    }
};
