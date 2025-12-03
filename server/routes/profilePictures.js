// i:\Proyectos\test\stocks-manager\server\routes\profilePictures.js
import express from 'express';
import multer from 'multer'; // Importar multer para manejar la subida de archivos
import { authenticate } from '../middleware/auth.js';
import ProfilePicture from '../models/ProfilePicture.js';
import User from '../models/User.js'; // Necesario para la asociación
import fs from 'fs'; // Importar fs para manejar operaciones de archivos
import crypto from 'crypto';

const router = express.Router();

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directorio donde se guardarán las imágenes de perfil
const PROFILE_PICTURES_DIR = path.join(__dirname, '..', 'images', 'profile-pictures');

// Configuración de Multer para almacenar la imagen en disco
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Asegurarse de que el directorio exista
    // fs.mkdirSync(PROFILE_PICTURES_DIR, { recursive: true }); // Esto se puede hacer al iniciar la app o manualmente
    cb(null, PROFILE_PICTURES_DIR);
  },
  filename: (req, file, cb) => {
    const userId = req.user.id;
    const extension = path.extname(file.originalname);
    const unique = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    cb(null, `${userId}-${unique}${extension}`);
  }
});

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
router.post('/', (req, res, next) => {
  upload.single('profilePicture')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('Error de Multer en subida de imagen:', err);
      return res.status(400).json({ error: err.message });
    } else if (err) {
      console.error('Error procesando subida de imagen:', err);
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  console.log('📤 Subida de imagen de perfil iniciada');
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha subido ninguna imagen.' });
    }

    const userId = req.user.id;
    const filename = req.file.filename; // Nombre del archivo guardado por Multer

    // Buscar si ya existe una imagen de perfil para este usuario
    let profilePicture = await ProfilePicture.findOne({ where: { userId } });

    if (profilePicture) {
      // Si existe, actualizarla (borrar la antigua y guardar la nueva referencia)
      // POR HACER: Considerar borrar el archivo antiguo del disco si existe
      profilePicture.filename = filename;
      await profilePicture.save();
      res.status(200).json({ message: 'Imagen de perfil actualizada correctamente.', filename });
    } else {
      // Si no existe, crear una nueva
      profilePicture = await ProfilePicture.create({
        userId,
        filename
      });
      res.status(201).json({ message: 'Imagen de perfil creada correctamente.', filename });
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

    const filePath = path.join(PROFILE_PICTURES_DIR, profilePicture.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo de imagen no encontrado.' });
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error('Error al obtener imagen de perfil:', error);
    res.status(500).json({ error: error.message || 'Error interno del servidor al obtener la imagen.' });
  }
});

// Ruta para eliminar la imagen de perfil del usuario autenticado
router.delete('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const profilePicture = await ProfilePicture.findOne({ where: { userId } });

    if (!profilePicture) {
      return res.status(404).json({ error: 'No se encontró imagen de perfil para eliminar.' });
    }

    // Eliminar el archivo físico del disco
    const filePath = path.join(PROFILE_PICTURES_DIR, profilePicture.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Archivo de imagen de perfil eliminado: ${filePath}`);
    }

    // Eliminar la entrada de la base de datos
    await profilePicture.destroy();

    res.status(200).json({ message: 'Imagen de perfil eliminada correctamente.' });
  } catch (error) {
    console.error('Error al eliminar imagen de perfil:', error);
    res.status(500).json({ error: error.message || 'Error interno del servidor al eliminar la imagen.' });
  }
});

export default router;
