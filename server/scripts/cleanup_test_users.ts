import 'dotenv/config';
import sql from '../db';

async function cleanup() {
    console.log('--- DIAGNOSTIC START ---');
    try {
        // List top 10 users to verify connection
        const users = await sql`SELECT email, created_at FROM users ORDER BY created_at DESC LIMIT 20`;
        console.log('Recent users in DB:', users.map(u => u.email));

        console.log(`Total users in DB: ${users.length} (sample)`);
    } catch (e) {
        console.error('Connection failed:', e);
        process.exit(1);
    }
    console.log('--- DIAGNOSTIC END ---');

    console.log('Cleaning up test users...');

    // Pattern matching for test users
    const patterns = [
        'logic_%',
        'job_%',
        'auth_%',
        'alert_%',
        'test_%'
    ];

    const specificEmails = [
        'pnl2@test.com',
        'auth_test@example.com',
        'test@example.com'
    ];

    let count = 0;

    try {
        // 1. Delete users by known patterns (using OR to reduce queries if possible, but loop is fine)
        for (const pattern of patterns) {
            const result = await sql`DELETE FROM users WHERE email LIKE ${pattern}`;
            if (result.count > 0) {
                console.log(`Deleted ${result.count} users matching pattern '${pattern}'`);
                count += result.count;
            }
        }

        // 2. Delete specific users
        for (const email of specificEmails) {
            const result = await sql`DELETE FROM users WHERE email = ${email}`;
            if (result.count > 0) {
                console.log(`Deleted user '${email}'`);
                count += result.count;
            }
        }

        // 3. Catch-all for @test.com domain
        const result = await sql`DELETE FROM users WHERE email LIKE '%@test.com'`;
        if (result.count > 0) {
            console.log(`Deleted ${result.count} users with @test.com domain`);
            count += result.count;
        }

        console.log(`Total deleted test users: ${count}`);
    } catch (e) {
        console.error('Error during cleanup:', e);
    } finally {
        // Close connection
        await sql.end();
        process.exit(0);
    }
}

cleanup();
