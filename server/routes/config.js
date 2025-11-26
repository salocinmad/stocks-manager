import express from 'express';
import Config from '../models/Config.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Obtener todas las configuraciones
router.get('/', authenticate, isAdmin, async (req, res) => {
  try {
    const configs = await Config.findAll();
    const configObject = {};
    configs.forEach(config => {
      configObject[config.key] = config.value;
    });
    res.json(configObject);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener una configuración por clave
router.get('/:key', authenticate, isAdmin, async (req, res) => {
  try {
    const config = await Config.findOne({ where: { key: req.params.key } });
    if (!config) {
      return res.json({ value: null });
    }
    res.json({ value: config.value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear o actualizar una configuración
router.post('/:key', authenticate, isAdmin, async (req, res) => {
  try {
    const { value } = req.body;

    const [config, created] = await Config.findOrCreate({
      where: { key: req.params.key },
      defaults: { value }
    });

    if (!created) {
      config.value = value;
      await config.save();
    }

    res.json(config);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Eliminar una configuración
router.delete('/:key', authenticate, isAdmin, async (req, res) => {
  try {
    const config = await Config.findOne({ where: { key: req.params.key } });

    if (!config) {
      return res.status(404).json({ error: 'Configuración no encontrada' });
    }

    await config.destroy();
    res.json({ message: 'Configuración eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

