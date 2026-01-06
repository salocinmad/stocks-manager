# 🧠 Memoria de Traspaso: Stocks Manager v2.1.0

Este documento es la guía para asegurar la continuidad del proyecto sin errores y protegiendo las funcionalidades existentes.

---

## 📋 DOCUMENTOS CLAVE DE REFERENCIA

| Documento | Propósito |
|-----------|-----------|
| `PROJECT_INDEX.md` | **Fuente de verdad** sobre estructura, arquitectura y funcionalidad de cada archivo |
| `RELEASE_NOTES.md` | Changelog completo de versiones |
| `init.sql` | Esquema SQL de las 23 tablas del sistema |
| `init_db.ts` | Gestor de arranque y migraciones automáticas |

---

## 🛑 REGLAS DE ORO: "QUÉ NO TOCAR"

1. **NO ELIMINAR EL MOTOR FINNHUB**: El motor Finnhub en `discoveryJob.ts` y `marketData.ts` es esencial para el mercado USA. Funciona bien.
2. **CONSERVACIÓN DE `syncPortfolioHistory`**: Proceso que corre a las 04:00 AM para sincronizar carteras. **No debe ser sustituido**.
3. **FIREWALL DE FINNHUB**: Lógica en `marketData.ts` que bloquea llamadas para tickers internacionales (ej. `.MC`). **Mantener**.
4. **REGLA DE LOS 7 DÍAS**: El sistema de descubrimiento respeta el filtro de "frescura" de 1 semana.

---

## 🏗️ ARQUITECTURA DEL CRAWLER HÍBRIDO

### Flujo de Tres Capas:

1. **Capa 0: Cosechadora Global (EODHD)**
   - Sincroniza mensualmente la tabla `global_tickers`
   - Solo almacena **'Common Stock'** (no ETFs ni derivados)
   - Guarda ISIN para mapeo universal

2. **Capa 1: Harvester de Descubrimiento (Dual Pipeline)**
   - **Pipeline USA (Finnhub)**: Motor de noticias. Intocable.
   - **Pipeline GLOBAL**: Yahoo Trending API para EU/ASIA

3. **Capa 2: Enriquecedor (Yahoo V10 Enhanced)**
   - Cálculos: Altman Z-Score, RSI, RSI7, SMA50/200, Sharpe, Volatilidad
   - Estrategia ISIN Fallback para símbolos fallidos
   - Persistencia incremental (Append)

---

## 📊 ESTRUCTURA DE BASE DE DATOS

**22 Tablas principales** (ver `init.sql` para detalle completo):

| Tabla | Propósito |
|-------|-----------|
| `users` | Usuarios, 2FA, preferencias |
| `portfolios` | Carteras de inversión |
| `positions` | Posiciones actuales por cartera |
| `transactions` | Historial de operaciones |
| `alerts` | Alertas de precio/técnicas |
| `portfolio_alerts` | Alertas Globales de carteras (incluye `triggered_assets` para tracking granular) |
| `watchlists` | Listas de seguimiento |
| `historical_data` | Datos OHLC históricos |
| `global_tickers` | Librería global con ISIN, `yahoo_status`, `yahoo_error` |
| `market_cache` | Caché persistente de datos de mercado con timestamp `updated_at` |
| `ticker_details_cache` | Datos profundos para modales de Discovery |
| `position_analysis_cache` | Métricas técnicas/riesgo precalculadas |
| `pnl_history_cache` | Historial de PnL por día |
| `ai_providers` | Proveedores de IA configurados |
| `ai_prompts` | Prompts personalizados |
| `chat_conversations` / `chat_messages` | Historial de chat IA |
| `financial_events` | Calendario de dividendos/ganancias |
| `system_settings` | Configuración global (`APP_VERSION`, índices de cabecera) |

---

## 🖥️ PANEL DE ADMINISTRACIÓN (v2.1.0)

### Estructura de Tabs:

| Tab | Subtabs | Funcionalidad |
|-----|---------|---------------|
| **General** | Configuración, SMTP | Seguridad, Email, Reset Global |
| **Inteligencia Artificial** | Proveedores, Prompts | Gestión de IA |
| **Mercado** | Sincronización, Índices de Cabecera, Discovery Engine | **NUEVO: 3 subtabs** |
| **Usuarios** | - | Gestión de usuarios |
| **Backup** | - | Respaldos y restauración |
| **Estadísticas** | - | Métricas del sistema |

### Tab Mercado (Reorganizado):
### Tab General (Subtabs):
- **Configuración**: URLs públicas.
- **SMTP**: Configuración de correo.
- **Alarmas (NUEVO)**: Acciones de emergencia. Restablecer TODAS las alertas y Lista Maestra de alertas.

### Tab Mercado (Reorganizado):
- **Sincronización**: Sync manual, Recálculo PnL, Librería Global, Enriquecimiento, Zona de Peligro
- **Índices de Cabecera**: Selector de índices globales para la cabecera
- **Discovery Engine**: Control maestro, Presets (Sigilo/Balanceado/Wolf), Ajustes granulares (sliders hasta 80 items)

---

## 🛠️ COMANDOS ESENCIALES (Docker)

```powershell
# Desplegar/Actualizar (OBLIGATORIO tras cambios)
docker compose up -d --build

# Ejecutar Tests
docker compose exec app bun test

# Ejecutar Script
docker compose exec app bun run server/scripts/nombre.ts

# Consultar BD
docker compose exec db psql -U admin -d stocks_manager -c "SELECT count(*) FROM users;"

# Ver Logs
docker compose logs app --tail 100
```

⚠️ **CRÍTICO**: Este proyecto NO tiene Bun local. Todo se ejecuta dentro de Docker.

---

## 📂 ARCHIVOS DE REFERENCIA

- `i:\dev\stocks-manager\PROJECT_INDEX.md` - Índice Maestro
- `i:\dev\stocks-manager\server\services\marketData.ts` - Lógica core de APIs
- `i:\dev\stocks-manager\server\jobs\discoveryJob.ts` - Orquestador del crawler
- `i:\dev\stocks-manager\server\index.ts` - Intervalos de ejecución
- `i:\dev\stocks-manager\src\screens\AdminScreen.tsx` - Panel de administración

---

**ÚLTIMA ACTUALIZACIÓN**: 6 Enero 2026 (v2.1.0)

### Cambios Recientes (Enero 2026):

#### Dashboard Layout 2 Columnas
Rediseño completo del Dashboard con estructura de dos columnas (75%/25%):
- **Columna Principal (lg:col-span-9)**: 
  - Fila 1: 3 tarjetas de stats (Patrimonio Neto, Variación Diaria, Ganancia Total)
  - AI Insight Result (condicional, entre stats y movers)
  - Fila 2: Mejores/Peores del Día
  - Fila 3: Gráfico PnL (ancho completo de columna)
- **Columna Lateral (lg:col-span-3)**:
  - Botón Análisis IA
  - Gráfico Distribución por Sector

#### Alertas Globales
Sistema de monitorización de todos los activos de un portfolio con cooldown individual (`triggered_assets` JSONB en `portfolio_alerts`).

#### Gráfico de Velas (Candlestick Chart) - FIX
- **Problema resuelto**: El gráfico de velas no aparecía en el modal de análisis del Discovery Engine.
- **Causa raíz**: La función `getDetailedHistory()` en `marketData.ts` devolvía objetos de Postgres que no se serializaban correctamente a JSON (aparecían como `[object Object][object Object]...`).
- **Solución**: Implementado mapeo explícito de postgres Row objects a objetos JavaScript planos con propiedades `date, open, high, low, close, volume` antes de devolver la respuesta.
- **Archivos afectados**: 
  - `server/services/marketData.ts` (función `getDetailedHistory` línea ~1603)
  - `src/components/DiscoveryAnalysisModal.tsx` (renderizado del chart)

#### Consolidación de API
- Endpoint `/api/alerts` unificado para todo tipo de alertas.
- Endpoint `/api/analysis/ticker/:ticker/history` para datos históricos OHLC.

#### UI Alertas
Rediseño de tarjetas compactas y grid de alta densidad en `AlertsScreen.tsx`.

#### Reset de Alertas
Botones para restablecer alertas disparadas (Individual y Global con limpieza de historial `triggered_assets`).

---

## 🔧 NOTAS TÉCNICAS IMPORTANTES

### Serialización de Datos de PostgreSQL
Al devolver datos de consultas SQL para APIs JSON, **siempre mapear los resultados** a objetos JavaScript planos:
```typescript
// ❌ Incorrecto - causa [object Object] en JSON
return await sql`SELECT * FROM table`;

// ✅ Correcto - serializa correctamente
const rows = await sql`SELECT * FROM table`;
return rows.map(row => ({
  field1: row.field1,
  field2: Number(row.field2),
  date: row.date instanceof Date ? row.date.toISOString() : String(row.date)
}));
```

### Tabla historical_data
Almacena datos OHLC para gráficos de velas. Actualmente contiene ~187,000+ registros principalmente de acciones de Hong Kong (.HK) y otros mercados. Usa índice `(ticker, date)` para consultas eficientes.
