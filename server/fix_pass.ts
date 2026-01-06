
import sql from './db';
async function run() {
    const email = 'patatotas@gmail.com';
    const hash = '$2b$10$5QNblIOh1tSw02BQKXdkO.nY976ZBqDgXIUBpWbgdFGAlUAhcDJMC'; // for prueba12
    await sql`UPDATE users SET password_hash = ${hash} WHERE email = ${email}`;
    console.log('Password updated for', email);
    process.exit(0);
}
run();
