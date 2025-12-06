import express from 'express';
import User from '../models/User.js';
import { generateToken, authenticate } from '../middleware/auth.js';

const router = express.Router();

// Función para obtener la contraseña maestra (se carga dinámicamente)
function getMasterPassword() {
  return process.env.MASTER_PASSWORD || 'Freedom2-Mud9-Garnish7-Tattle4-Vivacious4-Germinate3-Removal9-Harmonics5-Heave6';
}

import speakeasy from 'speakeasy';

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password, twoFactorToken } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    // Buscar usuario
    const user = await User.findOne({ where: { username: username.toLowerCase() } });
    if (!user) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    // Verificar contraseña
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    // Verificar 2FA si está habilitado
    if (user.isTwoFactorEnabled) {
      if (!twoFactorToken) {
        // Indicar al frontend que se requiere 2FA
        return res.json({ requiresTwoFactor: true });
      }

      // Verificar token 2FA
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: twoFactorToken
      });

      if (!verified) {
        return res.status(401).json({ error: 'Código 2FA incorrecto' });
      }
    }

    // Generar token
    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
        favoritePortfolioId: user.favoritePortfolioId || null
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// Verificar sesión actual
router.get('/me', authenticate, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({
      user: {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
        favoritePortfolioId: user.favoritePortfolioId || null
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al verificar sesión' });
  }
});

// Cambiar contraseña del usuario actual
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Contraseña actual y nueva contraseña son requeridas' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    // Buscar usuario
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Verificar contraseña actual
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }

    // Actualizar contraseña (el hook beforeUpdate se encargará del hash)
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('Error cambiando contraseña:', error);
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

// Recuperar contraseña de administrador (ruta pública, solo requiere contraseña maestra)
router.post('/recover-admin-password', async (req, res) => {
  console.log('🎯 RUTA /recover-admin-password LLAMADA');

  try {
    const { masterPassword, newPassword } = req.body;
    const expectedMasterPassword = getMasterPassword();

    if (!masterPassword || masterPassword !== expectedMasterPassword) {
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

    res.json({ message: 'Contraseña de administrador recuperada correctamente' });
  } catch (error) {
    console.error('Error recuperando contraseña de administrador:', error);
    res.status(500).json({ error: 'Error al recuperar contraseña de administrador' });
  }
});

export default router;

