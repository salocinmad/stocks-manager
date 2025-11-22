import express from 'express';
import Operation from '../models/Operation.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Obtener todas las operaciones del usuario actual
router.get('/', async (req, res) => {
  try {
    const operations = await Operation.findAll({
      where: { userId: req.user.id },
      order: [['date', 'DESC']]
    });
    res.json(operations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener una operación por ID (solo si pertenece al usuario)
router.get('/:id', async (req, res) => {
  try {
    const operation = await Operation.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });
    if (!operation) {
      return res.status(404).json({ error: 'Operación no encontrada' });
    }
    res.json(operation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear una nueva operación (asociada al usuario actual)
router.post('/', async (req, res) => {
  try {
    // Asegurar que la fecha sea un objeto Date
    const operationData = { ...req.body };
    if (operationData.date) {
      operationData.date = new Date(operationData.date);
    }
    // Asociar la operación al usuario actual
    operationData.userId = req.user.id;

    const operation = await Operation.create(operationData);
    res.status(201).json(operation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Actualizar una operación (solo si pertenece al usuario)
router.put('/:id', async (req, res) => {
  try {
    // Verificar que la operación pertenece al usuario
    const operation = await Operation.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!operation) {
      return res.status(404).json({ error: 'Operación no encontrada' });
    }

    // Asegurar que la fecha sea un objeto Date
    const updateData = { ...req.body };
    // No permitir cambiar el userId
    delete updateData.userId;
    if (updateData.date) {
      updateData.date = new Date(updateData.date);
    }

    await operation.update(updateData);
    res.json(operation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Eliminar una operación (solo si pertenece al usuario)
router.delete('/:id', async (req, res) => {
  try {
    const operation = await Operation.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!operation) {
      return res.status(404).json({ error: 'Operación no encontrada' });
    }

    await operation.destroy();
    res.json({ message: 'Operación eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar todas las operaciones del usuario actual
router.delete('/', async (req, res) => {
  try {
    await Operation.destroy({
      where: { userId: req.user.id }
    });
    res.json({ message: 'Todas las operaciones han sido eliminadas' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

