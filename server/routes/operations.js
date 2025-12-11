import express from 'express';
import { db } from '../config/database.js';
import { operations, portfolios, users } from '../drizzle/schema.js';
import { eq, and, asc, desc, count } from 'drizzle-orm';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

async function resolvePortfolioId(req) {
  const userId = req.user.id;
  const raw = req.query.portfolioId || req.body?.portfolioId;
  const id = raw ? parseInt(raw, 10) : null;
  if (id) {
    const exists = await db.select({ cnt: count() }).from(portfolios).where(and(eq(portfolios.id, id), eq(portfolios.userId, userId)));
    if (exists[0]?.cnt > 0) return id;
  }
  const uRes = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const u = uRes[0];
  if (u?.favoritePortfolioId) return u.favoritePortfolioId;
  const firstRes = await db.select({ id: portfolios.id }).from(portfolios).where(eq(portfolios.userId, userId)).orderBy(asc(portfolios.id)).limit(1);
  const first = firstRes[0];
  if (first) return first.id;
  return null;
}

// Obtener todas las operaciones del usuario actual
router.get('/', async (req, res) => {
  try {
    const portfolioId = await resolvePortfolioId(req);
    const ops = await db.select().from(operations).where(and(eq(operations.userId, req.user.id), eq(operations.portfolioId, portfolioId))).orderBy(desc(operations.date));
    res.json(ops);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener una operación por ID (solo si pertenece al usuario)
router.get('/:id', async (req, res) => {
  try {
    const portfolioId = await resolvePortfolioId(req);
    const opRes = await db.select().from(operations).where(and(eq(operations.id, parseInt(req.params.id)), eq(operations.userId, req.user.id), eq(operations.portfolioId, portfolioId))).limit(1);
    const operation = opRes[0];
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
    const [operation] = await db.insert(operations).values(operationData).returning();
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
    const operationResult = await db.select().from(operations).where(and(eq(operations.id, parseInt(req.params.id)), eq(operations.userId, req.user.id), eq(operations.portfolioId, portfolioId))).limit(1);
    const operation = operationResult[0];

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

    const [updatedOperation] = await db.update(operations).set(updateData).where(eq(operations.id, parseInt(req.params.id))).returning();
    res.json(updatedOperation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Eliminar una operación (solo si pertenece al usuario)
router.delete('/:id', async (req, res) => {
  try {
    const portfolioId = await resolvePortfolioId(req);
    const opRes = await db.select().from(operations).where(and(eq(operations.id, parseInt(req.params.id)), eq(operations.userId, req.user.id), eq(operations.portfolioId, portfolioId))).limit(1);
    const operation = opRes[0];
    if (!operation) {
      return res.status(404).json({ error: 'Operación no encontrada' });
    }
    await db.delete(operations).where(eq(operations.id, parseInt(req.params.id)));
    res.json({ message: 'Operación eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar todas las operaciones del usuario actual
router.delete('/', async (req, res) => {
  try {
    const portfolioId = await resolvePortfolioId(req);
    await db.delete(operations).where(and(eq(operations.userId, req.user.id), eq(operations.portfolioId, portfolioId)));
    res.json({ message: 'Todas las operaciones han sido eliminadas' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
