import { connectDB, db } from '../config/database.js';
import { users } from '../drizzle/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const initAdmin = async () => {
  try {
    await connectDB();

    const adminExists = await db.select().from(users).where(eq(users.username, 'admin'));

    if (adminExists.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await db.insert(users).values({
        username: 'admin',
        password: hashedPassword,
        isAdmin: true
      });
      console.log('✅ Usuario admin creado correctamente');
    } else {
      console.log('👤 Usuario admin ya existe');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error inicializando admin:', error);
    process.exit(1);
  }
};

initAdmin();
