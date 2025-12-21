import express from 'express';
import { Op } from 'sequelize';
import PortfolioReport from '../models/PortfolioReport.js';
import { generateDailyReport } from '../services/reportGenerator.js';
import { authenticate } from '../middleware/auth.js';
import { fetchDividends } from '../services/datasources/yahooService.js';
import { calculateActivePositions } from '../utils/dataAggregator.js';
import Operation from '../models/Operation.js';

const router = express.Router();

/**
 * Rutas API para gestión de reportes del portafolio
 * Todas las rutas requieren autenticación
 */

/**
 * GET /api/reports/current
 * Obtiene el reporte en tiempo real del portafolio actual
 * Query params:
 *   - portfolioId: ID del portafolio (requerido)
 *   - eurUsd: Tipo de cambio EUR/USD (opcional)
 */
router.get('/current', authenticate, async (req, res) => {
    try {
        const { portfolioId, eurUsd } = req.query;
        const userId = req.user.id;

        if (!portfolioId) {
            return res.status(400).json({ error: 'portfolioId is required' });
        }

        // Generar reporte en tiempo real (no se guarda en BD)
        const currentEURUSD = eurUsd ? parseFloat(eurUsd) : null;
        const date = new Date().toISOString().split('T')[0];

        const report = await generateDailyReport(
            userId,
            parseInt(portfolioId),
            date,
            currentEURUSD
        );

        if (!report) {
            return res.status(404).json({ error: 'No data available for this portfolio' });
        }

        res.json({ success: true, data: report });
    } catch (error) {
        console.error('Error generating current report:', error);
        res.status(500).json({ error: 'Failed to generate report', details: error.message });
    }
});

/**
 * GET /api/reports/history
 * Obtiene reportes históricos del portafolio
 * Query params:
 *   - portfolioId: ID del portafolio (requerido)
 *   - days: Número de días hacia atrás (default: 30)
 *   - startDate: Fecha inicial YYYY-MM-DD (opcional)
 *   - endDate: Fecha final YYYY-MM-DD (opcional)
 */
router.get('/history', authenticate, async (req, res) => {
    try {
        const { portfolioId, days = 30, startDate, endDate } = req.query;
        const userId = req.user.id;

        if (!portfolioId) {
            return res.status(400).json({ error: 'portfolioId is required' });
        }

        // Calcular rango de fechas
        let dateFilter = {};
        if (startDate && endDate) {
            dateFilter = {
                [Op.gte]: startDate,
                [Op.lte]: endDate
            };
        } else {
            const daysAgo = new Date();
            daysAgo.setDate(daysAgo.getDate() - parseInt(days));
            dateFilter = {
                [Op.gte]: daysAgo.toISOString().split('T')[0]
            };
        }

        const reports = await PortfolioReport.findAll({
            where: {
                userId,
                portfolioId: parseInt(portfolioId),
                reportType: 'daily',
                date: dateFilter
            },
            order: [['date', 'ASC']],
            attributes: ['id', 'date', 'data', 'createdAt']
        });

        res.json({
            success: true,
            count: reports.length,
            reports: reports.map(r => ({
                date: r.date,
                data: r.data,
                createdAt: r.createdAt
            }))
        });
    } catch (error) {
        console.error('Error fetching report history:', error);
        res.status(500).json({ error: 'Failed to fetch reports', details: error.message });
    }
});

/**
 * GET /api/reports/monthly
 * Obtiene reportes mensuales
 * Query params:
 *   - portfolioId: ID del portafolio (requerido)
 *   - year: Año (default: año actual)
 */
router.get('/monthly', authenticate, async (req, res) => {
    try {
        const { portfolioId, year = new Date().getFullYear() } = req.query;
        const userId = req.user.id;

        if (!portfolioId) {
            return res.status(400).json({ error: 'portfolioId is required' });
        }

        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;

        const reports = await PortfolioReport.findAll({
            where: {
                userId,
                portfolioId: parseInt(portfolioId),
                reportType: 'monthly',
                date: {
                    [Op.gte]: startDate,
                    [Op.lte]: endDate
                }
            },
            order: [['date', 'ASC']],
            attributes: ['id', 'date', 'data', 'createdAt']
        });

        res.json({
            success: true,
            year: parseInt(year),
            count: reports.length,
            reports: reports.map(r => ({
                date: r.date,
                data: r.data,
                createdAt: r.createdAt
            }))
        });
    } catch (error) {
        console.error('Error fetching monthly reports:', error);
        res.status(500).json({ error: 'Failed to fetch monthly reports', details: error.message });
    }
});

/**
 * GET /api/reports/yearly
 * Obtiene reportes anuales disponibles
 * Query params:
 *   - portfolioId: ID del portafolio (requerido)
 */
router.get('/yearly', authenticate, async (req, res) => {
    try {
        const { portfolioId } = req.query;
        const userId = req.user.id;

        if (!portfolioId) {
            return res.status(400).json({ error: 'portfolioId is required' });
        }

        const reports = await PortfolioReport.findAll({
            where: {
                userId,
                portfolioId: parseInt(portfolioId),
                reportType: 'yearly'
            },
            order: [['date', 'DESC']],
            attributes: ['id', 'date', 'data', 'createdAt']
        });

        res.json({
            success: true,
            count: reports.length,
            reports: reports.map(r => ({
                year: r.data.year,
                date: r.date,
                data: r.data,
                createdAt: r.createdAt
            }))
        });
    } catch (error) {
        console.error('Error fetching yearly reports:', error);
        res.status(500).json({ error: 'Failed to fetch yearly reports', details: error.message });
    }
});

/**
 * GET /api/reports/comparison
 * Compara el rendimiento de todos los portafolios del usuario
 * Query params:
 *   - days: Número de días hacia atrás (default: 30)
 */
router.get('/comparison', authenticate, async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const userId = req.user.id;

        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(days));

        // Obtener todos los reportes de todos los portafolios del usuario
        const reports = await PortfolioReport.findAll({
            where: {
                userId,
                reportType: 'daily',
                date: {
                    [Op.gte]: daysAgo.toISOString().split('T')[0]
                }
            },
            order: [['portfolioId', 'ASC'], ['date', 'ASC']],
            attributes: ['portfolioId', 'date', 'data'],
            include: [{
                model: require('../models/Portfolio.js').default,
                attributes: ['id', 'name']
            }]
        });

        // Agrupar por portafolio
        const grouped = {};
        reports.forEach(report => {
            const portfolioId = report.portfolioId;
            if (!grouped[portfolioId]) {
                grouped[portfolioId] = {
                    portfolioId,
                    portfolioName: report.Portfolio ? report.Portfolio.name : 'Unknown',
                    reports: []
                };
            }
            grouped[portfolioId].reports.push({
                date: report.date,
                roi: report.data.roi,
                pnlEUR: report.data.pnlEUR,
                totalValueEUR: report.data.totalValueEUR
            });
        });

        // Calcular métricas comparativas
        const comparison = Object.values(grouped).map(portfolio => {
            const lastReport = portfolio.reports[portfolio.reports.length - 1];
            const firstReport = portfolio.reports[0];

            return {
                portfolioId: portfolio.portfolioId,
                portfolioName: portfolio.portfolioName,
                currentROI: lastReport ? lastReport.roi : 0,
                currentPnL: lastReport ? lastReport.pnlEUR : 0,
                currentValue: lastReport ? lastReport.totalValueEUR : 0,
                periodGrowth: firstReport && lastReport
                    ? ((lastReport.totalValueEUR - firstReport.totalValueEUR) / firstReport.totalValueEUR) * 100
                    : 0,
                dataPoints: portfolio.reports
            };
        });

        // Ordenar por ROI descendente
        comparison.sort((a, b) => b.currentROI - a.currentROI);

        res.json({
            success: true,
            count: comparison.length,
            days: parseInt(days),
            portfolios: comparison
        });
    } catch (error) {
        console.error('Error generating comparison:', error);
        res.status(500).json({ error: 'Failed to generate comparison', details: error.message });
    }
});

/**
 * DELETE /api/reports/:id
 * Elimina un reporte específico (solo el propio usuario puede eliminar sus reportes)
 */
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const report = await PortfolioReport.findOne({
            where: { id: parseInt(id), userId }
        });

        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        await report.destroy();

        res.json({ success: true, message: 'Report deleted successfully' });
    } catch (error) {
        console.error('Error deleting report:', error);
        res.status(500).json({ error: 'Failed to delete report', details: error.message });
    }
});

/**
 * GET /api/reports/dividends
 * Obtiene el historial de dividendos basado en la cantidad de acciones poseídas en la fecha ex-dividend
 */
router.get('/dividends', authenticate, async (req, res) => {
    try {
        const { portfolioId } = req.query;
        const userId = req.user.id;

        if (!portfolioId) {
            return res.status(400).json({ error: 'portfolioId is required' });
        }

        // Obtener TODAS las operaciones cronológicamente
        const operations = await Operation.findAll({
            where: { userId, portfolioId: parseInt(portfolioId) },
            order: [['date', 'ASC'], ['id', 'ASC']]
        });

        if (operations.length === 0) {
            return res.json({ success: true, dividends: [] });
        }

        // Agrupar operaciones por posición
        const groupedOps = {};
        operations.forEach(op => {
            const key = op.symbol ? `${op.company}|||${op.symbol}` : op.company;
            if (!groupedOps[key]) groupedOps[key] = [];
            groupedOps[key].push(op.get({ plain: true }));
        });

        const symbols = Object.keys(groupedOps);

        // Obtener dividendos para cada símbolo (últimos 2 años)
        const dividendsPromises = symbols.map(async (symbol) => {
            try {
                const history = await fetchDividends(symbol, 730); // 2 años
                if (!history || history.length === 0) return null;

                const symbolOps = groupedOps[symbol];
                const validHistory = [];

                history.forEach(div => {
                    const divDate = new Date(div.date);

                    // Calcular acciones poseídas al inicio del día ex-dividend
                    // Regla: Se deben poseer las acciones antes de la fecha ex-dividend
                    let sharesHeldOnExDate = 0;
                    symbolOps.forEach(op => {
                        const opDate = new Date(op.date);
                        // Normalizamos a solo fecha para la comparación
                        const opDateOnly = new Date(opDate.getFullYear(), opDate.getMonth(), opDate.getDate());
                        const divDateOnly = new Date(divDate.getFullYear(), divDate.getMonth(), divDate.getDate());

                        if (opDateOnly < divDateOnly) {
                            sharesHeldOnExDate += (op.type === 'purchase' ? op.shares : -op.shares);
                        }
                    });

                    // Si en esa fecha teníamos acciones, este dividendo cuenta
                    if (sharesHeldOnExDate > 0.0001) {
                        validHistory.push({
                            ...div,
                            shares: sharesHeldOnExDate,
                            totalReceived: div.amount * sharesHeldOnExDate
                        });
                    }
                });

                if (validHistory.length > 0) {
                    return {
                        symbol,
                        company: symbol.split('|||')[0],
                        history: validHistory
                    };
                }
            } catch (err) {
                console.error(`Error fetching dividends for ${symbol}:`, err);
            }
            return null;
        });

        const results = (await Promise.all(dividendsPromises)).filter(r => r !== null);

        res.json({
            success: true,
            dividends: results
        });
    } catch (error) {
        console.error('Error fetching dividends report:', error);
        res.status(500).json({ error: 'Failed to fetch dividends data' });
    }
});

export default router;
