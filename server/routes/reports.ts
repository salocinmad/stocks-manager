
import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import sql from '../db';

export const reportsRoutes = new Elysia({ prefix: '/reports' })
    .use(
        jwt({
            name: 'jwt',
            secret: process.env.JWT_SECRET || 'changeme_in_prod'
        })
    )
    .derive(async ({ jwt, headers, set }) => {
        const auth = headers['authorization'];
        if (!auth?.startsWith('Bearer ')) {
            set.status = 401;
            throw new Error('Unauthorized');
        }
        const token = auth.slice(7);
        const profile = await jwt.verify(token) as { sub?: string } | false;

        if (!profile || !profile.sub) {
            set.status = 401;
            throw new Error('Unauthorized');
        }

        return { userId: profile.sub };
    })
    // 0. Obtener años fiscales disponibles
    .get('/years', async ({ query, userId, set }) => {
        const portfolioId = (query as any).portfolioId;
        if (!portfolioId) {
            set.status = 400;
            throw new Error('Portfolio ID is required');
        }

        // Obtener años distintos donde haya transacciones
        const result = await sql`
            SELECT DISTINCT EXTRACT(YEAR FROM date) as year 
            FROM transactions 
            WHERE portfolio_id = ${portfolioId}
            AND portfolio_id IN (SELECT id FROM portfolios WHERE user_id = ${userId})
            ORDER BY year DESC
        `;

        // Si no hay operaciones, devolvemos al menos el año actual
        const years = result.map(r => Number(r.year));
        if (years.length === 0) {
            return [new Date().getFullYear()];
        }
        return years;
    })

    // 1. Obtener datos fiscales (Cálculo FIFO)
    .get('/aeat/:year', async ({ params, userId, query, set }) => {
        const year = parseInt(params.year);
        const portfolioId = (query as any).portfolioId;

        if (!portfolioId) {
            set.status = 400;
            throw new Error('Portfolio ID is required');
        }

        // Obtener TODAS las transacciones hasta el final del año seleccionado de la cartera específica
        // FIFO requiere la historia completa para saber el precio de compra original
        const transactions = await sql`
            SELECT * FROM transactions 
            WHERE portfolio_id = ${portfolioId}
            AND portfolio_id IN (SELECT id FROM portfolios WHERE user_id = ${userId}) -- Seguridad: que sea del usuario
            AND date <= ${new Date(year, 11, 31).toISOString()}
            ORDER BY date ASC
        `;

        // Motor FIFO
        const inventory: Record<string, any[]> = {}; // ticker -> cola de lotes de compra
        const fiscalOperations: any[] = [];
        const dividends: any[] = [];

        for (const tx of transactions) {
            const ticker = tx.ticker;
            const quantity = parseFloat(tx.amount); // Ojo: en DB amount es cantidad de acciones? Necesito verificar el schema
            // En mi schema transactions: amount, price_per_unit, type
            // amount es cantidad de acciones o dinero? 
            // Revisando init_db: "amount DECIMAL NOT NULL" y "price_per_unit". Normalmente amount es cantidad.

            // Normalizar datos numéricos
            const qty = Math.abs(parseFloat(tx.amount));
            const price = parseFloat(tx.price_per_unit);
            const date = new Date(tx.date);
            // Asumimos gastos 0 por ahora si no hay campo fee en DB. 
            // Si hay exchange_rate_to_eur, aplicarlo.
            const rate = parseFloat(tx.exchange_rate_to_eur || '1');
            const priceEur = price * rate;

            if (tx.type === 'BUY') {
                if (!inventory[ticker]) inventory[ticker] = [];
                inventory[ticker].push({
                    date,
                    qty,
                    priceEur,
                    originalPrice: price,
                    currency: tx.currency
                });
            } else if (tx.type === 'SELL') {
                let remainingToSell = qty;

                // Consumir inventario FIFO
                if (!inventory[ticker]) inventory[ticker] = [];

                while (remainingToSell > 0 && inventory[ticker].length > 0) {
                    const batch = inventory[ticker][0];
                    const take = Math.min(batch.qty, remainingToSell);

                    // Calcular valores para ESTE lote específico
                    const lotSaleValueEur = take * priceEur; // Valor venta de este fragmento
                    const lotCostBasisEur = take * batch.priceEur; // Coste base de este fragmento (precio original lote)
                    const lotGainLossEur = lotSaleValueEur - lotCostBasisEur;

                    // Solo registrar si la venta ocurrió en el AÑO FISCAL solicitado
                    if (date.getFullYear() === year) {
                        fiscalOperations.push({
                            ticker,
                            saleDate: date,
                            buyDate: batch.date, // Fecha exacta del lote
                            qty: take,
                            salePriceEur: priceEur,
                            buyPriceEur: lotCostBasisEur / take, // Precio unitario compra original (debería ser batch.priceEur)
                            saleValueEur: lotSaleValueEur,
                            costBasisEur: lotCostBasisEur,
                            gainLossEur: lotGainLossEur,
                            currency: tx.currency
                        });
                    }

                    remainingToSell -= take;
                    batch.qty -= take;

                    if (batch.qty <= 0.00001) { // Margen error float
                        inventory[ticker].shift(); // Lote agotado
                    }
                }

                if (remainingToSell > 0.00001) {
                    // Venta descubierta (sin compra previa registrada)
                    // Registramos la operación con coste 0 (o lo que decida el usuario, por defecto 0 para ser conservador fiscalmente)
                    if (date.getFullYear() === year) {
                        const amount = remainingToSell;
                        const valEur = amount * priceEur;
                        fiscalOperations.push({
                            ticker,
                            saleDate: date,
                            buyDate: 'N/A (Sin histórico)',
                            qty: amount,
                            salePriceEur: priceEur,
                            buyPriceEur: 0,
                            saleValueEur: valEur,
                            costBasisEur: 0,
                            gainLossEur: valEur, // Ganancia total
                            currency: tx.currency
                        });
                    }
                    console.warn(`Venta descubierta detectada para ${ticker}: ${remainingToSell}`);
                }
            } else if (tx.type === 'DIVIDEND') { // Si existiera este tipo
                if (date.getFullYear() === year) {
                    dividends.push({
                        date,
                        ticker,
                        amountEur: qty * priceEur // En dividendos la logica puede variar segun como se guarden
                    });
                }
            }
        }

        // Resumen
        const totalGainLoss = fiscalOperations.reduce((sum, op) => sum + op.gainLossEur, 0);

        return {
            year,
            operations: fiscalOperations,
            summary: {
                totalGainLoss,
                totalOperations: fiscalOperations.length
            }
        };
    })
