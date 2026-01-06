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

**23 Tablas principales** (ver `init.sql` para detalle completo):

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

**ÚLTIMA ACTUALIZACIÓN**: Enero 2026 (v2.1.0)
- **Alertas Globales**: Sistema de monitorización de todos los activos de un portfolio con cooldown individual (`triggered_assets` JSONB).
- **Consolidación de API**: Endpoint `/api/alerts` unificado para todo tipo de alertas.
- **UI Alertas**: Rediseño de tarjetas compactas y grid de alta densidad.
- **Reset de Alertas**: Botones para restablecer alertas disparadas (Individual y Global con limpieza de historial `triggered_assets`).
- **Esquema DB**: Inclusión de `updated_at` en `market_cache` para mejor consistencia de caché.
