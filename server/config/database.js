import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/portfolio-manager';
    console.log('🔗 Intentando conectar a MongoDB...');
    console.log('   URI configurada:', mongoUri.includes('mongodb+srv') ? 'MongoDB Atlas ✅' : 'MongoDB Local ❌');
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000, // Timeout de 10 segundos para Atlas
      socketTimeoutMS: 45000,
    });
    console.log(`✅ MongoDB conectado: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    console.error('💡 Soluciones:');
    console.error('   1. Instala MongoDB local: https://www.mongodb.com/try/download/community');
    console.error('   2. O usa MongoDB Atlas (gratis): https://www.mongodb.com/cloud/atlas');
    console.error('   3. Actualiza MONGODB_URI en server/.env');
    console.error('');
    console.error('⚠️  El servidor continuará pero no podrá guardar datos hasta que MongoDB esté disponible.');
    return false;
  }
};

