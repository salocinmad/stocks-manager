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

    await operation.update(updateData);
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


/**
 * @desc    Identify symbols for a list of items (Pre-import check)
 * @route   POST /api/operations/identify-symbols
 * @access  Private
 */
router.post('/identify-symbols', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Invalid items array' });
    }

    // Dynamic import to ensure service is available
    const { resolveSymbol } = await import('../services/securitySymbolService.js');

    const results = [];
    // Process in parallel or batches? Parallel is fine for reasonable size
    // Using simple loop for now to avoid hammering APIs if rate limited, 
    // but Promise.all is better for speed if we mostly hit cache/DB.
    // Let's use Promise.all with simple throttle if needed, but for now direct.

    // We'll process sequentially to be safe with Yahoo/OpenFIGI rate limits if they apply per connection
    for (const item of items) {
      let result = { symbol: '', currency: '', name: '' };
      if (item.isin || item.companyName) {
        try {
          const res = await resolveSymbol(item.isin, item.companyName);
          if (res && res.symbol) {
            result = {
              symbol: res.symbol,
              currency: res.currency,
              name: res.name
            };
          }
        } catch (e) {
          console.warn('Error resolving symbol pre-import:', e.message);
        }
      }
      results.push({ ...item, ...result });
    }

    res.json({ results });

  } catch (error) {
    console.error('Error identifying symbols:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @desc    Import operations batch
 * @route   POST /api/operations/import
 * @access  Private
 */
router.post('/import', async (req, res) => {
  try {
    const { operations } = req.body;
    if (!Array.isArray(operations) || operations.length === 0) {
      return res.status(400).json({ error: 'No se enviaron operaciones' });
    }

    const stats = {
      imported: 0,
      failed: 0,
      ratesFetched: 0
    };

    const results = [];

    // Import services dynamically if not top-level
    const { getHistoricalExchangeRate } = await import('../services/historicalExchangeRateService.js');
    const { resolveSymbol } = await import('../services/securitySymbolService.js');

    for (const op of operations) {
      try {
        // 1. Resolve Symbol if missing but ISIN present
        if (!op.symbol && op.isin) {
          const resolved = await resolveSymbol(op.isin, op.companyName);
          op.symbol = resolved?.symbol;
        }

        if (!op.symbol) {
          throw new Error(`No se pudo identificar el Ticker para ISIN: ${op.isin} / Nombre: ${op.companyName}`);
        }

        // 2. Fetch Exchange Rate if missing and not EUR
        if (!op.exchangeRate && op.currency !== 'EUR') {
          const rate = await getHistoricalExchangeRate(op.currency, op.date);
          if (rate) {
            op.exchangeRate = rate;
            stats.ratesFetched++;
          } else {
            op.exchangeRate = 1;
          }
        } else if (op.currency === 'EUR') {
          op.exchangeRate = 1;
        }

        // 3. Create Operation
        const newOp = await Operation.create({
          userId: req.user.id,
          portfolioId: op.portfolioId || req.user.favoritePortfolioId,
          date: op.date,
          type: op.type,
          company: op.companyName || op.symbol,
          symbol: op.symbol,
          shares: parseFloat(op.shares),
          price: parseFloat(op.price),
          currency: op.currency,
          exchangeRate: parseFloat(op.exchangeRate || 1),
          commission: parseFloat(op.commission || 0),
          totalCost: (parseFloat(op.shares) * parseFloat(op.price)) + parseFloat(op.commission || 0),
          notes: `Importado CSV (ISIN: ${op.isin || 'N/A'})`
        });

        // Update AssetProfile linkage asynchronously
        if (op.isin && op.symbol) {
          resolveSymbol(op.isin, op.companyName).catch(() => { });
        }

        stats.imported++;
        results.push({ status: 'ok', id: newOp.id });

      } catch (err) {
        console.error('Error importing row:', err.message);
        stats.failed++;
        results.push({ status: 'error', error: err.message, row: op });
      }
    }

    res.json({ message: 'Importación completada', stats, results });

  } catch (error) {
    console.error('Error en importación masiva:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

