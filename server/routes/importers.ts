
import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import sql from '../db';
import * as XLSX from 'xlsx';
import { MarketDataService } from '../services/marketData';

export const importersRoutes = new Elysia({ prefix: '/importers' })
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

    // POST /importers/myinvestor/preview
    // Sube el archivo, lo parsea y devuelve una vista previa para confirmar (sin guardar aún)
    .post('/myinvestor/preview', async ({ body, userId }) => {
        // @ts-ignore
        const file = body.file as File;
        if (!file) throw new Error('No file uploaded');

        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Usar header: 1 para obtener arrays crudos [A, B, C...]
        // Esto evita problemas con nombres de cabecera mal codificados o celdas combinadas
        const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        // MyInvestor orden: Descendente (más nuevo arriba). Invertimos.
        const rows = rawRows.reverse();

        const previewData = [];

        // Mapeo por índices fijos observados en salida.xls:
        // 0: Fecha Ops
        // 1: Fecha Liq
        // 2: ID Operación
        // 3: Mercado
        // 4: Tipo (COMPRA/VENTA)
        // 5: ISIN
        // 6: Nombre
        // 7: Cantidad
        // 8: Divisa
        // 9: Precio
        // 10: Importe

        for (const row of rows) {
            // Validar fila de datos: Debe tener ISIN en col 5 y Tipo en col 4
            if (!row[5] || !row[4]) continue;

            // Ignorar cabeceras basura comprobando que fecha sea numero o tipo sea valido
            const rawType = String(row[4]).toUpperCase().trim();
            if (rawType !== 'COMPRA' && rawType !== 'VENTA') continue;

            const isin = String(row[5]).trim();
            const type = rawType === 'COMPRA' ? 'BUY' : 'SELL';

            // Fecha: Col 0. Puede ser numero serie Excel (ej 46002)
            let date = new Date();
            if (typeof row[0] === 'number') {
                // Ajuste Excel date 1900 epoch (-25569 dias * ms)
                // Ojo con zona horaria, usar UTC para dia
                const dateInfo = XLSX.SSF.parse_date_code(row[0]);
                if (dateInfo) {
                    date = new Date(Date.UTC(dateInfo.y, dateInfo.m - 1, dateInfo.d));
                }
            } else {
                // Fallback string parser
                date = new Date(row[0]);
            }
            // Validar fecha
            if (isNaN(date.getTime())) date = new Date();

            // Usar nueva función para detalles (incluye divisa de Yahoo)
            const details = await MarketDataService.getTickerDetailsByISIN(isin);
            const ticker = details?.symbol || isin;

            // Cantidad y Precio pueden venir como strings con comas o puntos
            let cantidad = 0;
            let precio = 0;

            const parseNum = (val: any) => {
                if (typeof val === 'number') return val;
                if (typeof val === 'string') return parseFloat(val.replace(',', '.'));
                return 0;
            };

            cantidad = parseNum(row[7]);
            precio = parseNum(row[9]);
            let divisa = String(row[8] || 'EUR').trim();

            // REGLA UK / LONDRES (.L) Y ISIN GB:
            // Si el ticker termina en .L Y el ISIN empieza por GB, y la divisa es GBP...
            // MyInvestor etiqueta incorrectamente la divisa.
            // En realidad son Peniques (GBp). Lo renombramos a GBp para que el sistema lo distinga.
            if (ticker.endsWith('.L') && isin.startsWith('GB') && divisa === 'GBP') {
                divisa = 'GBp';
            }

            // Calcular importe
            const importe = cantidad * precio;

            previewData.push({
                date: date.toISOString(),
                type,
                ticker,
                isin,
                shares: cantidad,
                price: precio,
                currency: divisa,
                total: importe,
                originalRow: row // Guardamos para debug
            });
        }

        return { success: true, count: previewData.length, data: previewData };
    }, {
        body: t.Object({
            file: t.File()
        })
    })

    // POST /importers/myinvestor/confirm
    // Procesa los datos confirmados y los guarda en DB
    .post('/myinvestor/confirm', async ({ body, userId }) => {
        // @ts-ignore
        const { operations, portfolioId } = body;

        if (!operations || operations.length === 0) throw new Error('No operations to import');

        let importedCount = 0;

        for (const op of operations) {
            // Verificar si duplicado (simple check: mismo ticker, misma fecha exacta, misma cantidad)
            // ... (Omitido para MVP, insertamos todo)

            // Obtener tipo de cambio EUR si divisa no es EUR
            let exchangeRate = 1.0;
            if (op.currency !== 'EUR') {
                // Manejo especial para Peniques (GBp)
                if (op.currency === 'GBp') {
                    // Obtenemos el rate de la Libra (GBP -> EUR)
                    const gbpRate = await MarketDataService.getHistoricalExchangeRate('GBP', 'EUR', new Date(op.date));
                    // 1 GBp = 0.01 GBP. Por tanto el valor en EUR de 1 GBp es el valor de 1 GBP / 100.
                    exchangeRate = gbpRate / 100;
                } else {
                    // Consultar histórico real normal
                    exchangeRate = await MarketDataService.getHistoricalExchangeRate(op.currency, 'EUR', new Date(op.date));
                }
            }

            try {
                await sql.begin(async sql => {
                    // 1. Insertar Transacción
                    const [tx] = await sql`
                        INSERT INTO transactions (
                            portfolio_id, ticker, type, amount, price_per_unit, currency, 
                            exchange_rate_to_eur, date
                        ) VALUES (
                            ${portfolioId}, ${op.ticker}, ${op.type}, ${op.shares}, ${op.price}, ${op.currency},
                            ${exchangeRate}, ${op.date}
                        )
                        RETURNING id
                    `;

                    // 2. Actualizar Posición (Simplificado: Recalcular o sumar)
                    // Lo mejor es hacer un UPSERT sumando cantidad
                    const signedQty = op.type === 'BUY' ? op.shares : -op.shares;

                    // Necesitamos saber precio promedio si es compra
                    // Si es venta, el precio promedio no cambia (FIFO accounting is for tax, average cost is for display)

                    // Buscar posición existente
                    const [existingPos] = await sql`
                        SELECT quantity, average_buy_price FROM positions 
                        WHERE portfolio_id = ${portfolioId} AND ticker = ${op.ticker}
                    `;

                    if (existingPos) {
                        const oldQty = parseFloat(existingPos.quantity);
                        const oldAvg = parseFloat(existingPos.average_buy_price);

                        let newQty = oldQty + signedQty;
                        let newAvg = oldAvg;

                        if (op.type === 'BUY') {
                            // Media ponderada
                            // (OldQty * OldAvg + NewQty * NewPrice) / TotalQty
                            // Convertir todo a EUR para la media? O mantener divisa original?
                            // El sistema parece guardar average_buy_price en divisa original.
                            const totalCost = (oldQty * oldAvg) + (op.shares * op.price);
                            newAvg = totalCost / newQty;
                        }

                        // Si vendemos todo, reset
                        if (newQty <= 0.000001) {
                            await sql`DELETE FROM positions WHERE portfolio_id = ${portfolioId} AND ticker = ${op.ticker}`;
                        } else {
                            await sql`
                                UPDATE positions 
                                SET quantity = ${newQty}, average_buy_price = ${newAvg}, updated_at = NOW()
                                WHERE portfolio_id = ${portfolioId} AND ticker = ${op.ticker}
                            `;
                        }
                    } else if (op.type === 'BUY') {
                        // Crear nueva
                        await sql`
                            INSERT INTO positions (
                                portfolio_id, ticker, quantity, average_buy_price, currency, asset_type
                            ) VALUES (
                                ${portfolioId}, ${op.ticker}, ${op.shares}, ${op.price}, ${op.currency}, 'STOCK'
                            )
                        `;
                    }
                });
                importedCount++;
            } catch (err) {
                console.error(`Error importing op for ${op.ticker}:`, err);
            }
        }

        return { success: true, imported: importedCount };
    }, {
        body: t.Object({
            portfolioId: t.String(),
            operations: t.Array(t.Object({
                date: t.String(),
                type: t.String(),
                ticker: t.String(),
                shares: t.Number(),
                price: t.Number(),
                currency: t.String()
            }))
        })
    });
