import express from 'express';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * @desc    Setup 2FA - Generates a secret and QR code
 * @route   POST /api/2fa/setup
 * @access  Private
 */
router.post('/setup', authenticate, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const secret = speakeasy.generateSecret({
            name: `StocksManager (${user.username})`
        });

        // Store temp secret
        user.twoFactorTempSecret = secret.base32;
        await user.save();

        // Generate QR Code
        QRCode.toDataURL(secret.otpauth_url, (err, data_url) => {
            if (err) {
                return res.status(500).json({ error: 'Error generando QR code' });
            }
            res.json({
                secret: secret.base32, // Envía el secreto en texto también
                qrCode: data_url
            });
        });
    } catch (error) {
        console.error('Error en setup 2FA:', error);
        res.status(500).json({ error: 'Error al configurar 2FA' });
    }
});

/**
 * @desc    Verify 2FA token and enable it
 * @route   POST /api/2fa/verify
 * @access  Private
 */
router.post('/verify', authenticate, async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ error: 'Token es requerido' });
        }

        const user = await User.findByPk(req.user.id);
        if (!user || !user.twoFactorTempSecret) {
            return res.status(400).json({ error: 'No hay configuración de 2FA pendiente' });
        }

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorTempSecret,
            encoding: 'base32',
            token: token
        });

        if (verified) {
            user.twoFactorSecret = user.twoFactorTempSecret;
            user.twoFactorTempSecret = null;
            user.isTwoFactorEnabled = true;
            await user.save();
            res.json({ message: '2FA activado correctamente' });
        } else {
            res.status(400).json({ error: 'Código incorrecto' });
        }
    } catch (error) {
        console.error('Error en verify 2FA:', error);
        res.status(500).json({ error: 'Error al verificar 2FA' });
    }
});

/**
 * @desc    Disable 2FA
 * @route   POST /api/2fa/disable
 * @access  Private
    } catch (error) {
        console.error('Error en disable 2FA:', error);
        res.status(500).json({ error: 'Error al desactivar 2FA' });
    }
});

/**
 * @desc    Get 2FA status
 * @route   GET /api/2fa/status
 * @access  Private
 */
router.get('/status', authenticate, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json({ isTwoFactorEnabled: user.isTwoFactorEnabled });
    } catch (error) {
        console.error('Error en status 2FA:', error);
        res.status(500).json({ error: 'Error al obtener estado de 2FA' });
    }
});

export default router;
