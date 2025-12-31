
import sql from '../db';

async function checkUserAvatar() {
    try {
        const users = await sql`SELECT id, email, avatar_url FROM users`;
        console.log('Users found:', users.length);
        users.forEach(u => {
            console.log(`User: ${u.email}`);
            console.log(`ID: ${u.id}`);
            console.log(`Avatar URL: ${u.avatar_url || 'NULL'}`);
            console.log('-------------------');
        });
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkUserAvatar();
