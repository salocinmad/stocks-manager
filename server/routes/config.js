import express from 'express';
import Config from '../models/Config.js';

const router = express.Router();

// Obtener todas las configuraciones
router.get('/', async (req, res) => {
  try {
    const configs = await Config.find();
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
router.get('/:key', async (req, res) => {
  try {
    const config = await Config.findOne({ key: req.params.key });
    if (!config) {
      return res.json({ value: null });
    }
    res.json({ value: config.value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear o actualizar una configuración
router.post('/:key', async (req, res) => {
  try {
    const { value } = req.body;
    const config = await Config.findOneAndUpdate(
      { key: req.params.key },
      { value },
      { upsert: true, new: true }
    );
    res.json(config);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Eliminar una configuración
router.delete('/:key', async (req, res) => {
  try {
    const config = await Config.findOneAndDelete({ key: req.params.key });
    if (!config) {
      return res.status(404).json({ error: 'Configuración no encontrada' });
    }
    res.json({ message: 'Configuración eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

