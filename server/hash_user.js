import bcrypt from 'bcryptjs';
const hash = await bcrypt.hash('prueba12', 10);
process.stdout.write(hash);
