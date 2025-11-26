## Objetivo
Persistir el último "Precio actual" por posición para cada usuario, mostrarlo inmediatamente al cargar la página y actualizarlo en cada sincronización con Finnhub/Yahoo. Si la sincronización falla u offline, se muestra el último precio persistido.

## Diseño
- **Nuevo modelo** `server/models/PriceCache.js`: almacena `userId`, `positionKey` (formato `company|||symbol`), `lastPrice`, `change`, `changePercent` y timestamps. Índice único `(userId, positionKey)`.
- **Nuevas rutas backend** `server/routes/prices.js`:
  - `POST /api/prices/bulk` recibe `{ positionKeys: string[] }` y devuelve `{ [positionKey]: { price, change, changePercent, updatedAt } }` para el `req.user.id`.
  - `PUT /api/prices/:positionKey` upsert del último precio para el usuario actual.
- **Registro de rutas** en `server/server.js`: `app.use('/api/prices', pricesRoutes)`.
- **Servicio frontend** `pricesAPI` en `src/services/api.js`:
  - `getBulk(positionKeys)` → `POST /prices/bulk`.
  - `upsert(positionKey, data)` → `PUT /prices/:positionKey`.
- **App.jsx**:
  - Prefill de `currentPrices` con caché al cargar operaciones (antes de pedir precios en vivo).
  - Tras obtener cada `priceData` en `fetchAllCurrentPrices`, enviar `upsert` para persistir.
  - El prefill funciona aunque no haya API key; la sincronización en vivo sigue condicionada por `finnhubApiKey`.

## Cambios concretos
- `server/models/PriceCache.js`: nuevo modelo Sequelize con `tableName: 'PriceCaches'`, `timestamps: true`, índices y FK a `Users`.
- `server/routes/prices.js`:
  - Usa `authenticate`.
  - Valida entrada, consulta por `userId`, responde un mapa compacto.
  - Upsert: `findOne({ userId, positionKey })` → `update` o `create`.
- `server/server.js`: agrega import y `app.use('/api/prices', pricesRoutes)`.
- `src/services/api.js`: exporta `pricesAPI` con `getBulk` y `upsert` usando `authenticatedFetch`.
- `src/App.jsx`:
  - Nuevo helper `prefillPricesFromCache()` que:
    - Obtiene `Object.keys(getActivePositions())`.
    - Llama `pricesAPI.getBulk()` y hace `setCurrentPrices(...)`.
  - En `loadData` tras `setOperations(...)`, invoca `prefillPricesFromCache()`.
  - En `fetchAllCurrentPrices`, tras cada `priceData`, invoca `pricesAPI.upsert(positionKey, { price, change, changePercent })` con `Promise.allSettled`.

## Consideraciones
- **Esquema**: `sequelize.sync({ alter: true })` creará la tabla automáticamente en MariaDB del Docker.
- **Moneda**: el precio almacenado está en la moneda de la acción; la UI ya deduce moneda desde compras, por lo que no se necesita guardar `currency` en caché.
- **Escenarios offline**: la página mostrará inmediatamente el último precio guardado; si el fetch en vivo falla o no hay API key, el valor persiste.
- **Rendimiento**: ruta `bulk` evita N llamadas, devuelve solo campos necesarios.

## Verificación (en tu servidor Docker)
1. Arranca el stack y abre la UI.
2. Carga la página: ver "Precio actual" con valores desde caché (si existían); si no, quedará "Sin datos" hasta primera sincronización.
3. Pulsa "Actualizar Precios": se actualizan y se persisten; recarga página para comprobar que se muestran al instante.
4. Simula fallo de red: los precios siguen visibles desde caché.

## Entregables
- Implementación de modelo, rutas y servicio.
- Actualización de `App.jsx` para prefill y persistencia.
- Guía breve de prueba manual y rollback seguro.

¿Confirmas que proceda a aplicar estos cambios?