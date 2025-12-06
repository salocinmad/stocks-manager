import { connectDB } from '../config/database.js';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const initAdmin = async () => {
  try {
    await connectDB();

    const adminExists = await User.findOne({ where: { username: 'admin' } });

    if (!adminExists) {
      await User.create({
        username: 'admin',
        password: 'admin123',
        isAdmin: true
      });
      console.log('✅ Usuario admin creado correctamente');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error inicializando admin:', error);
    process.exit(1);
  }
};

initAdmin();
