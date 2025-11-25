// i:\Proyectos\test\stocks-manager\server\models\ProfilePicture.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import User from './User.js'; // Importar el modelo User para la asociación

const ProfilePicture = sequelize.define('ProfilePicture', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true, // Un usuario solo puede tener una imagen de perfil
    references: {
      model: 'Users', // Nombre de la tabla de usuarios (asegúrate de que coincida con el nombre de la tabla de User)
      key: 'id'
    }
  },
  imageData: {
    type: DataTypes.BLOB('long'), // Para almacenar datos binarios de la imagen
    allowNull: false
  },
  mimeType: {
    type: DataTypes.STRING, // Por ejemplo, 'image/jpeg', 'image/png'
    allowNull: false
  }
});

// Definir la asociación aquí mismo
ProfilePicture.belongsTo(User, { foreignKey: 'userId' });
User.hasOne(ProfilePicture, { foreignKey: 'userId' });

export default ProfilePicture;