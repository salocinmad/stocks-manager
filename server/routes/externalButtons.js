import express from 'express';
import { Op } from 'sequelize';
import ExternalLinkButton from '../models/ExternalLinkButton.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Obtener todos los botones externos del usuario actual
router.get('/', async (req, res) => {
    try {
        const buttons = await ExternalLinkButton.findAll({
            where: { userId: req.user.id },
            order: [['displayOrder', 'ASC']]
        });
        res.json(buttons);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Crear un nuevo botón externo
router.post('/', async (req, res) => {
    try {
        const { name, baseUrl, imageUrl, displayOrder } = req.body;

        // Validar que no existan más de 3 botones
        const existingCount = await ExternalLinkButton.count({
            where: { userId: req.user.id }
        });

        if (existingCount >= 3) {
            return res.status(400).json({
                error: 'Ya tienes 3 botones configurados. Elimina uno antes de agregar otro.'
            });
        }

        // Validar displayOrder
        if (!displayOrder || displayOrder < 1 || displayOrder > 3) {
            return res.status(400).json({
                error: 'displayOrder debe ser 1, 2 o 3'
            });
        }

        // Verificar que no exista otro botón con el mismo displayOrder para este usuario
        const existingButton = await ExternalLinkButton.findOne({
            where: { userId: req.user.id, displayOrder }
        });

        if (existingButton) {
            return res.status(400).json({
                error: `Ya existe un botón con displayOrder ${displayOrder}`
            });
        }

        const button = await ExternalLinkButton.create({
            userId: req.user.id,
            name,
            baseUrl,
            imageUrl,
            displayOrder
        });

        res.status(201).json(button);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Actualizar un botón externo
router.put('/:id', async (req, res) => {
    try {
        const button = await ExternalLinkButton.findOne({
            where: { id: req.params.id, userId: req.user.id }
        });

        if (!button) {
            return res.status(404).json({ error: 'Botón no encontrado' });
        }

        const { name, baseUrl, imageUrl, displayOrder } = req.body;

        // Si se está cambiando el displayOrder, verificar que no esté ocupado
        if (displayOrder && displayOrder !== button.displayOrder) {
            const existingButton = await ExternalLinkButton.findOne({
                where: {
                    userId: req.user.id,
                    displayOrder,
                    id: { [Op.ne]: req.params.id }
                }
            });

            if (existingButton) {
                return res.status(400).json({
                    error: `Ya existe un botón con displayOrder ${displayOrder}`
                });
            }
        }

        await button.update({
            name: name !== undefined ? name : button.name,
            baseUrl: baseUrl !== undefined ? baseUrl : button.baseUrl,
            imageUrl: imageUrl !== undefined ? imageUrl : button.imageUrl,
            displayOrder: displayOrder !== undefined ? displayOrder : button.displayOrder
        });

        res.json(button);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Eliminar un botón externo
router.delete('/:id', async (req, res) => {
    try {
        const button = await ExternalLinkButton.findOne({
            where: { id: req.params.id, userId: req.user.id }
        });

        if (!button) {
            return res.status(404).json({ error: 'Botón no encontrado' });
        }

        await button.destroy();
        res.json({ message: 'Botón eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
