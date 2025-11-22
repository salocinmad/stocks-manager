import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'portfolio_manager',
  process.env.DB_USER || 'user',
  process.env.DB_PASS || 'password',
  {
    host: process.env.DB_HOST || 'mariadb',
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado a MariaDB correctamente');

    // Sincronizar modelos con la base de datos
    // alter: true actualiza las tablas si hay cambios en los modelos
    await sequelize.sync({ alter: true });
    console.log('✅ Modelos sincronizados');
  } catch (error) {
    console.error('❌ Error conectando a MariaDB:', error);
    process.exit(1);
  }
};

export default sequelize;
