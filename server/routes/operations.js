import express from 'express';
import Operation from '../models/Operation.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Obtener todas las operaciones del usuario actual
router.get('/', async (req, res) => {
  try {
    const operations = await Operation.find({ userId: req.user.id }).sort({ date: -1 });
    res.json(operations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener una operación por ID (solo si pertenece al usuario)
router.get('/:id', async (req, res) => {
  try {
    const operation = await Operation.findOne({ _id: req.params.id, userId: req.user.id });
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
    const operation = new Operation(operationData);
    await operation.save();
    res.status(201).json(operation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Actualizar una operación (solo si pertenece al usuario)
router.put('/:id', async (req, res) => {
  try {
    // Verificar que la operación pertenece al usuario
    const existingOperation = await Operation.findOne({ _id: req.params.id, userId: req.user.id });
    if (!existingOperation) {
      return res.status(404).json({ error: 'Operación no encontrada' });
    }

    // Asegurar que la fecha sea un objeto Date
    const updateData = { ...req.body };
    // No permitir cambiar el userId
    delete updateData.userId;
    if (updateData.date) {
      updateData.date = new Date(updateData.date);
    }
    const operation = await Operation.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    res.json(operation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Eliminar una operación (solo si pertenece al usuario)
router.delete('/:id', async (req, res) => {
  try {
    const operation = await Operation.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!operation) {
      return res.status(404).json({ error: 'Operación no encontrada' });
    }
    res.json({ message: 'Operación eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar todas las operaciones del usuario actual
router.delete('/', async (req, res) => {
  try {
    await Operation.deleteMany({ userId: req.user.id });
    res.json({ message: 'Todas las operaciones han sido eliminadas' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

