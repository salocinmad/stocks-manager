// i:\Proyectos\test\stocks-manager\server\routes\profilePictures.js
import express from 'express';
import multer from 'multer'; // Importar multer para manejar la subida de archivos
import { authenticate } from '../middleware/auth.js';
import ProfilePicture from '../models/ProfilePicture.js';
import User from '../models/User.js'; // Necesario para la asociación

const router = express.Router();

// Configuración de Multer para almacenar la imagen en memoria
// Esto es importante porque la vamos a guardar como BLOB en la DB
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Límite de 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen.'), false);
    }
  }
});

// Todas las rutas requieren autenticación
router.use(authenticate);

// Ruta para subir o actualizar la imagen de perfil
router.post('/', upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha subido ninguna imagen.' });
    }

    const userId = req.user.id;
    const imageData = req.file.buffer; // Datos binarios de la imagen
    const mimeType = req.file.mimetype; // Tipo MIME de la imagen

    // Buscar si ya existe una imagen de perfil para este usuario
    let profilePicture = await ProfilePicture.findOne({ where: { userId } });

    if (profilePicture) {
      // Si existe, actualizarla
      profilePicture.imageData = imageData;
      profilePicture.mimeType = mimeType;
      await profilePicture.save();
      res.status(200).json({ message: 'Imagen de perfil actualizada correctamente.' });
    } else {
      // Si no existe, crear una nueva
      profilePicture = await ProfilePicture.create({
        userId,
        imageData,
        mimeType
      });
      res.status(201).json({ message: 'Imagen de perfil creada correctamente.' });
    }
  } catch (error) {
    console.error('Error al subir/actualizar imagen de perfil:', error);
    res.status(500).json({ error: error.message || 'Error interno del servidor al subir la imagen.' });
  }
});

// Ruta para obtener la imagen de perfil del usuario autenticado
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const profilePicture = await ProfilePicture.findOne({ where: { userId } });

    if (!profilePicture) {
      return res.status(404).json({ error: 'Imagen de perfil no encontrada.' });
    }

    // Establecer el tipo de contenido y enviar los datos binarios
    res.set('Content-Type', profilePicture.mimeType);
    res.send(profilePicture.imageData);
  } catch (error) {
    console.error('Error al obtener imagen de perfil:', error);
    res.status(500).json({ error: error.message || 'Error interno del servidor al obtener la imagen.' });
  }
});

// Ruta para eliminar la imagen de perfil del usuario autenticado
router.delete('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await ProfilePicture.destroy({ where: { userId } });

    if (result === 0) {
      return res.status(404).json({ error: 'No se encontró imagen de perfil para eliminar.' });
    }

    res.status(200).json({ message: 'Imagen de perfil eliminada correctamente.' });
  } catch (error) {
    console.error('Error al eliminar imagen de perfil:', error);
    res.status(500).json({ error: error.message || 'Error interno del servidor al eliminar la imagen.' });
  }
});

export default router;