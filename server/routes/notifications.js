import express from 'express';
import { sendNotification } from '../services/notify.js';

const router = express.Router();

// POST /api/notifications/stop-loss
router.post('/stop-loss', async (req, res) => {
  const { company, symbol, currentPrice, stopLossPrice } = req.body;

  const subject = `Precio stop loss o de aviso alcanzado`;
  const text = `
    ¡Hola!

    Se ha activado una alerta de Stop Loss para tu posición en ${company} (${symbol}).

    Precio actual: ${currentPrice}
    Precio de Stop Loss: ${stopLossPrice}

    Considera revisar tu inversión.

    Saludos,
    Tu Gestor de Inversiones
  `;

  const result = await sendNotification({ subject, text });

  if (result.ok) {
    res.status(200).json({ success: true, message: 'Email sent successfully.' });
  } else {
    res.status(500).json({ success: false, message: `Error sending email: ${result.reason}` });
  }
});

export default router;
