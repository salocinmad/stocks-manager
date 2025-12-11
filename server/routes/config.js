import express from 'express';
import { db } from '../config/database.js';
import * as schema from '../drizzle/schema.js';
import { eq } from 'drizzle-orm';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Obtener todas las configuraciones
router.get('/', authenticate, isAdmin, async (req, res) => {
  try {
    const configsResult = await db.select().from(schema.configs);
    const configObject = {};
    configsResult.forEach(config => {
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
    const config = await db.query.configs.findFirst({ where: eq(schema.configs.key, req.params.key) });
    res.json({ value: config?.value ?? null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear o actualizar una configuración
router.post('/:key', authenticate, isAdmin, async (req, res) => {
  try {
    const { value } = req.body;

    const existing = await db.query.configs.findFirst({ where: eq(schema.configs.key, req.params.key) });

    let config;
    if (existing) {
      await db.update(schema.configs).set({ value }).where(eq(schema.configs.key, req.params.key));
      config = await db.query.configs.findFirst({ where: eq(schema.configs.key, req.params.key) });
    } else {
      [config] = await db.insert(schema.configs).values({ key: req.params.key, value }).returning();
    }

    res.json(config);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Eliminar una configuración
router.delete('/:key', authenticate, isAdmin, async (req, res) => {
  try {
    const deleted = await db.delete(schema.configs)
      .where(eq(schema.configs.key, req.params.key));
    if (deleted.length === 0) {
      return res.status(404).json({ error: 'Configuración no encontrada' });
    }
    res.json({ message: 'Configuración eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

