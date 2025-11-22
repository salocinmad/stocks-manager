import express from 'express';
import User from '../models/User.js';
import Config from '../models/Config.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Obtener API key global de Finnhub (público para todos los usuarios autenticados)
router.get('/finnhub-api-key', async (req, res) => {
  try {
    const config = await Config.findOne({ where: { key: 'finnhub-api-key' } });
    if (!config) {
      return res.json({ value: null });
    }
    res.json({ value: config.value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Todas las demás rutas requieren ser administrador
router.use(isAdmin);

// Obtener todos los usuarios
router.get('/users', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear nuevo usuario
router.post('/users', async (req, res) => {
  try {
    const { username, password, isAdmin: adminFlag } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({ where: { username: username.toLowerCase() } });
    if (existingUser) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }

    // Crear nuevo usuario
    const newUser = await User.create({
      username: username.toLowerCase(),
      password, // Se cifrará automáticamente en el hook beforeCreate
      isAdmin: adminFlag || false
    });

    // Devolver usuario sin contraseña
    const userResponse = newUser.toJSON();
    delete userResponse.password;

    res.status(201).json(userResponse);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Eliminar usuario
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    // No permitir eliminar al propio usuario administrador
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    await user.destroy();

    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Recuperar contraseña de administrador (requiere contraseña maestra)
router.post('/reset-admin-password', async (req, res) => {
  try {
    const { masterPassword, newPassword } = req.body;

    // Contraseña maestra
    const MASTER_PASSWORD = process.env.MASTER_PASSWORD || 'Freedom2-Mud9-Garnish7-Tattle4-Vivacious4-Germinate3-Removal9-Harmonics5-Heave6';

    if (!masterPassword || masterPassword !== MASTER_PASSWORD) {
      return res.status(401).json({ error: 'Contraseña maestra incorrecta' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    // Buscar usuario administrador (el primero que encuentre)
    const adminUser = await User.findOne({ where: { isAdmin: true } });
    if (!adminUser) {
      return res.status(404).json({ error: 'No se encontró ningún usuario administrador' });
    }

    // Actualizar contraseña
    adminUser.password = newPassword;
    await adminUser.save();

    res.json({ message: 'Contraseña de administrador actualizada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cambiar contraseña de un usuario
router.put('/users/:id/password', async (req, res) => {
  try {
    const { newPassword } = req.body;
    const userId = req.params.id;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Configurar API key global de Finnhub (solo admin)
router.post('/finnhub-api-key', async (req, res) => {
  try {
    const { value } = req.body;

    const [config, created] = await Config.findOrCreate({
      where: { key: 'finnhub-api-key' },
      defaults: { value }
    });

    if (!created) {
      config.value = value;
      await config.save();
    }

    res.json({ message: 'API Key configurada correctamente', value: config.value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

