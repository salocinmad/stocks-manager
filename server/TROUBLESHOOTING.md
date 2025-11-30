# Troubleshooting - Errores de Inicio del Servidor

## Error #1: yahooFinance.setGlobalConfig is not a function

**Causa**: yahoo-finance2 v3 cambió la API, ya no tiene `setGlobalConfig` como método del objeto.

**Solución aplicada**:
```javascript
// ANTES (incorrecto):
import yahooFinance from 'yahoo-finance2';
yahooFinance.setGlobalConfig({ ... });  // ❌ No existe en v3

// DESPUÉS (correcto):
import yahooFinance from 'yahoo-finance2';
export default yahooFinance;  // ✅ Yahoo v3 funciona out-of-the-box
```

**Archivo modificado**: `server/services/datasources/yahooFinanceInstance.js`

---

## Error #2: Duplicate route /api/prices

**Causa**: Existían 2 rutas registradas para `/api/prices`:
- `pricesRoutes` (antigua)
- `pricesApiRoutes` (nueva API modular)

**Solución aplicada**:
```javascript
// Commentar ruta antigua
// app.use('/api/prices', pricesRoutes);  // ← DEPRECATED

// Usar solo la nueva
app.use('/api/prices', pricesApiRoutes);  // ← NUEVO: API modular
```

**Archivo modificado**: `server/server.js`

---

## Verificación de Módulos

**Script creado**: `server/verify-modules.mjs`

**Uso**:
```bash
cd server
node verify-modules.mjs
```

**Output esperado**:
```
🔍 Verificando módulos del servidor...

📦 Utils:
✅ constants
✅ dateHelpers
✅ symbolHelpers
✅ exchangeRateService

📊 Models:
✅ GlobalCurrentPrice
✅ GlobalStockPrice
✅ UserStockAlert

🔌 Datasources:
✅ yahooFinanceInstance
✅ finnhubService
✅ yahooService
✅ priceCombinaService

💲 Price Services:
✅ currentPriceService
✅ historicalPriceService

⏰ Scheduler:
✅ priceScheduler
✅ scheduler (wrapper)

🌐 API Routes:
✅ prices API

============================================================

✅ Passed: 17
❌ Failed: 0

🎉 Todos los módulos se importan correctamente
```

---

## Checklist de Verificación Pre-Inicio

- [x] `yahooFinanceInstance.js` sin `setGlobalConfig`
- [x] Rutas de `/api/prices` sin duplicar
- [x] Todos los imports de datasources correctos
- [x] Models registrados en database.js
- [x] Middleware `authenticate` exportado correctamente
- [x] Script de verificación disponible

---

## Errores Comunes y Soluciones

### ImportError: Cannot find module
**Solución**: Verificar que el path sea relativo correcto (`../../` desde subdirectorios)

### TypeError: X is not a function
**Solución**: Verificar que la función esté exportada con `export` o `export default`

### Circular dependency detected
**Solución**: Revisar imports circulares y usar imports dinámicos si es necesario

### Database not ready
**Solución**: El startup script ya espera a MariaDB (hasta 30 intentos)

---

## Próximos Pasos para Iniciar

1. **Verificar módulos**:
   ```bash
   cd server && node verify-modules.mjs
   ```

2. **Reiniciar Docker**:
   ```bash
   docker compose restart server
   ```

3. **Ver logs**:
   ```bash
   docker compose logs -f server
   ```

4. **Esperar mensajes**:
   ```
   ✅ Conectado a MariaDB correctamente
   ✅ Modelos sincronizados
   🚀 Iniciando scheduler de precios...
   ✅ Scheduler de precios iniciado
   Server running on port 5000
   ```

---

**Sistema listo para arrancar** ✅
