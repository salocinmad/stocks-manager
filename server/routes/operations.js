import express from 'express';
import Operation from '../models/Operation.js';
import Portfolio from '../models/Portfolio.js';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

async function resolvePortfolioId(req) {
  const userId = req.user.id;
  const raw = req.query.portfolioId || req.body?.portfolioId;
  const id = raw ? parseInt(raw, 10) : null;
  if (id) {
    const exists = await Portfolio.count({ where: { id, userId } });
    if (exists) return id;
  }
  const u = await User.findByPk(userId);
  if (u?.favoritePortfolioId) {
    return u.favoritePortfolioId;
  }
  const first = await Portfolio.findOne({ where: { userId }, order: [['id', 'ASC']] });
  if (first) return first.id;
  return null;
}

// Obtener todas las operaciones del usuario actual
router.get('/', async (req, res) => {
  try {
    const portfolioId = await resolvePortfolioId(req);
    const operations = await Operation.findAll({
      where: { userId: req.user.id, portfolioId },
      order: [['date', 'DESC']]
    });
    res.json(operations);
  } catch (error) {
    console.error('❌ Error in GET /api/operations:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener una operación por ID (solo si pertenece al usuario)
router.get('/:id', async (req, res) => {
  try {
    const portfolioId = await resolvePortfolioId(req);
    const operation = await Operation.findOne({
      where: { id: req.params.id, userId: req.user.id, portfolioId }
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
    operationData.portfolioId = await resolvePortfolioId(req);

    const operation = await Operation.create(operationData);

    // Resetear alertas para esta posición al crear una nueva operación
    if (operation.targetPrice || operation.stopLossPrice) {
      const PriceCache = (await import('../models/PriceCache.js')).default;
      const positionKey = operation.symbol ? `${operation.company}|||${operation.symbol}` : operation.company;
      await PriceCache.update(
        { targetHitNotifiedAt: null, stopLossHitNotifiedAt: null },
        { where: { userId: req.user.id, portfolioId: operation.portfolioId, positionKey } }
      ).catch(() => { }); // Ignorar si no existe el cache aún
    }

    res.status(201).json(operation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Actualizar una operación (solo si pertenece al usuario)
router.put('/:id', async (req, res) => {
  try {
    // Verificar que la operación pertenece al usuario
    const portfolioId = await resolvePortfolioId(req);
    const operation = await Operation.findOne({
      where: { id: req.params.id, userId: req.user.id, portfolioId }
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

    const oldTarget = operation.targetPrice;
    const oldStop = operation.stopLossPrice;

    await operation.update(updateData);

    // Si han cambiado los umbrales, resetear las notificaciones en el PriceCache
    if (oldTarget !== operation.targetPrice || oldStop !== operation.stopLossPrice) {
      const PriceCache = (await import('../models/PriceCache.js')).default;
      const positionKey = operation.symbol ? `${operation.company}|||${operation.symbol}` : operation.company;
      await PriceCache.update(
        { targetHitNotifiedAt: null, stopLossHitNotifiedAt: null },
        { where: { userId: req.user.id, portfolioId, positionKey } }
      );
    }

    res.json(operation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Eliminar una operación (solo si pertenece al usuario)
router.delete('/:id', async (req, res) => {
  try {
    const portfolioId = await resolvePortfolioId(req);
    const operation = await Operation.findOne({
      where: { id: req.params.id, userId: req.user.id, portfolioId }
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
    const portfolioId = await resolvePortfolioId(req);
    await Operation.destroy({
      where: { userId: req.user.id, portfolioId }
    });
    res.json({ message: 'Todas las operaciones han sido eliminadas' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

