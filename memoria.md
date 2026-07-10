# 📚 Stocks Manager - Memoria del Proyecto

> **Versión actual: 2.1.3** | Última actualización: 8 Julio 2026
> 
> Este documento proporciona una visión global del proyecto para contexto de IA en futuras conversaciones.

---

## 🎯 Descripción General

**Stocks Manager** es una plataforma completa de gestión de carteras de inversión desarrollada con:
- **Frontend**: React 19 + TailwindCSS + Recharts
- **Backend**: Bun runtime + ElysiaJS + PostgreSQL 16
- **AI**: Multi-provider (Google Gemini, OpenRouter, Groq, Ollama, LM Studio)
- **Infraestructura**: Docker + Docker Compose
- **PWA**: Instalable en Android (v2.1.1)

---

## 🏗️ Arquitectura

```
stocks-manager/
├── server/                    # Backend ElysiaJS
│   ├── routes/               # API endpoints (~15 archivos)
│   ├── services/             # Lógica de negocio (~20 servicios)
│   ├── jobs/                 # Cron jobs (Discovery, Alerts, PnL, Calendar, Backup)
│   ├── utils/                # Logger, exchangeMapping, helpers
│   ├── scripts/              # test_runner.ts, cleanup_test_users.ts
│   └── init_db.ts            # Schema completo + migraciones automáticas
├── src/                       # Frontend React
│   ├── components/           # ~40 componentes reutilizables
│   │   └── admin/            # Componentes del panel admin
│   ├── screens/              # ~15 páginas/vistas
│   ├── context/              # AuthContext (global state)
│   └── utils/                # Formatters, helpers frontend
├── public/                    # Assets estáticos
│   ├── manifest.json         # Configuración PWA
│   ├── sw.js                 # Service Worker
│   └── pwa-*.png             # Iconos PWA
├── dist/                      # Build de producción (generado)
├── uploads/                   # Avatares y adjuntos de notas
└── documentation (.md files)
```

---

## 🗄️ Base de Datos (PostgreSQL 16)

### Tablas Principales (23 tablas):

| Tabla | Descripción |
|-------|-------------|
| `users` | Usuarios (email, password_hash, 2FA, avatar, locale, role) |
| `portfolios` | Carteras de inversión |
| `positions` | Posiciones/holdings (UNIQUE portfolio_id + ticker) |
| `transactions` | Historial de operaciones (BUY/SELL/DIVIDEND) |
| `alerts` | Alertas por ticker individual |
| `portfolio_alerts` | Alertas globales de portafolio (triggered_assets JSONB) |
| `global_tickers` | Catálogo maestro de tickers (77+ bolsas) |
| `market_discovery_cache` | Cache del Discovery Engine |
| `ticker_details_cache` | Cache de datos de mercado (Yahoo V8/V10) |
| `position_analysis_cache` | Cache de análisis de posiciones (6 tabs) |
| `financial_events` | Dividendos, splits, earnings (updated_at) |
| `pnl_history_cache` | Histórico PnL pre-calculado (agregado) |
| `pnl_history_detail` | **[v2.1.2]** Detalle PnL por posición (auditoría) |
| `currency_history` | Tipos de cambio históricos |
| `ai_prompts` | Prompts del sistema de IA (editables) |
| `ai_providers` | Proveedores de IA configurados |
| `chat_conversations` | Conversaciones del ChatBot |
| `chat_messages` | Mensajes del ChatBot |
| `system_settings` | Configuración global (APP_VERSION, CRAWLER_*, etc.) |
| `watchlists` | Listas de seguimiento |
| `watchlist_items` | Items de las watchlists |
| `notes` | Notas con imágenes (Markdown) |
| `notification_channels` | Canales de notificación (email, push, in-app) |

### Configuración Crítica en `system_settings`:
- `APP_VERSION`: V2.1.3 (mostrada en modales)
- `JWT_SECRET`: **CRÍTICO** - necesario para descifrar backups
- `CRAWLER_*`: Configuración del Discovery Engine
- `GLOBAL_TICKER_EXCHANGES`: Bolsas activas para sincronización

---

## 🔧 Características Principales

### 💰 PnL y Conversión de Divisa - v2.1.2 [NUEVO]
- **Tabla `pnl_history_detail`**: Almacena detalle por posición para auditoría completa (ticker, precios, monedas, tasas, cost EUR, value EUR, PnL EUR)
- **Conversión GBX→GBP**: Manejo automático de peniques (multiplicador 0.01) para acciones de LSE
- **Comisiones desde transacciones**: Se calculan desde `SUM(transactions.fees)` en lugar de `positions.commission` (fix de sincronización)
- **Variación Diaria Consistente**: Ahora calcula `PnL hoy - PnL ayer` usando `pnl_history_cache` para consistencia con el gráfico
- **Tasas separadas**: Cost Basis usa moneda de posición, Market Value usa moneda de cotización

### 📱 PWA (Progressive Web App) - v2.1.1
- **Instalable en Android**: Chrome → Menú ⋮ → "Añadir a pantalla de inicio"
- **Manifest.json**: Nombre, colores (#0f172a navy, #fce903 amarillo), iconos
- **Service Worker**: Cache de assets estáticos (network-first para API)
- **Logo**: Escudo amarillo con barras de crecimiento + flecha de tendencia
- **Iconos**: pwa-192x192, pwa-512x512, logo-1024, favicon.png

### 💬 ChatBot Responsive - v2.1.1
- **Mobile**: Fullscreen 100% con padding inferior para navbar (pb-20)
- **Desktop**: Ventana flotante con tamaños md/lg/xl
- **Streaming**: Respuestas de IA en tiempo real
- **Historial**: Conversaciones persistentes en BD

### 🔐 Auth Screens Responsive - v2.1.1
- **Login, 2FA, Reset Password**: Adaptados para móviles
- **Mobile**: `min-h-screen` scrolleable, `justify-start` (desde arriba)
- **Desktop**: Centrado vertical tradicional
- **Espaciado compacto**: `p-5` (móvil) vs `p-14` (desktop)
- **Tipografía adaptativa**: `text-xl` (móvil) vs `text-4xl` (desktop)

### 🌍 Catálogo Maestro Configurable
- 77+ bolsas mundiales (NYSE, NASDAQ, AMEX + globales)
- Global Ticker Job para sincronización vía EODHD
- Limpieza automática al desmarcar bolsas

### 🖥️ Dashboard y Panel Admin Responsive - v2.1.1
- **Dashboard 2 Columnas**: Layout adaptativo (75/25 en desktop, apilado en móvil).
- **Auto-Refresh**: Actualización automática de datos cada 5 minutos (background) sin recarga.
- **Panel Admin Full Responsive**: Los 8 componentes del panel admin (`AIGeneral`, `AIProviders`, `AdminSMTP`, `LogsManager`, `MasterCatalogConfig`, `MarketIndicesSelector`, `DataExplorerTable`, `AuthSettings`) han sido rediseñados para pantallas móviles con:
  - Containers con padding adaptativo (`p-4 md:p-6`).
  - Grids inteligentes (`grid-cols-1 sm:grid-cols-2`).
  - Sub-tabs con scroll horizontal y `scrollbar-hide`.
  - Botones y títulos con tipografía responsive.

### 🔔 Sistema de Alertas
- Individuales: Precio, %, RSI, SMA, Volumen
- Globales: Vigila todos los activos con cooldown por ticker

### 🕸️ Discovery Engine v2 (Split-World)
- Pipeline US: Finnhub → Yahoo
- Pipeline Global: Yahoo Screeners multi-región
- Marcado de tickers fallidos (yahoo_status)

### 📊 Position Analysis Modal (6 tabs)
1. Resumen (datos cartera, peso, PnL)
2. Técnico (RSI, SMA, Bollinger, tendencia)
3. Fundamental (PER, EPS, Fair Value/Graham)
4. Proyección (escenarios)
5. Riesgo (Volatilidad, Sharpe, VaR95, Beta)
6. Eventos (Dividendos, Earnings, Splits)

### 🤖 Sistema de IA Multi-Provider
- Proveedores: Gemini, OpenRouter, Groq, Ollama, LM Studio
- Prompts editables desde Admin → IA → Prompts
- Factory pattern en `aiFactory.ts`

### 📧 Notificaciones
- Email (SMTP configurable)
- Push browser (Web Notifications)
- In-app (badge en header)

### 💾 Backups Automáticos
- Scheduler: diario/semanal/mensual (dayOfWeek, dayOfMonth)
- Cifrado AES-256 con JWT_SECRET
- Envío por email opcional

---

## 🔑 Variables de Entorno Críticas

```env
# Base de datos
DB_HOST=stocks_db
DB_PORT=5432
DB_NAME=stocks_db
DB_USER=postgres
DB_PASSWORD=<segura>

# Seguridad (¡CRÍTICO PARA BACKUPS!)
JWT_SECRET=<string-64-chars-único>

# APIs externas
FINNHUB_API_KEY=<key>
GOOGLE_GENAI_API_KEY=<key>
OPENROUTER_API_KEY=<key>
GROQ_API_KEY=<key>

# Email (opcional)
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM

# Crawler
CRAWLER_ENABLED=true
CRAWLER_CYCLES_PER_HOUR=6
```

---

## 📁 Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `server/init_db.ts` | Schema DB + migraciones automáticas |
| `server/index.ts` | Entry point + todos los jobs |
| `src/context/AuthContext.tsx` | Auth global + appVersion |
| `public/manifest.json` | Configuración PWA |
| `public/sw.js` | Service Worker |
| `Dockerfile` | Build multi-stage (builder → release) |
| `docker-compose.yml` | Dev environment |
| `docker-compose.prod.yml` | Producción (imagen GHCR) |

---

## 🚀 Comandos de Despliegue

### Desarrollo:
```bash
docker compose up -d --build
```

### Producción (imagen pre-built):
```bash
docker compose -f docker-compose.prod.yml up -d
```

### Tests:
```bash
bun run server/scripts/test_runner.ts
```

---

## 📝 Historial de Versiones

| Versión | Fecha | Cambios Principales |
|---------|-------|---------------------|
| **2.1.3** | 8 Jul 2026 | Pestaña Lotes FIFO en modal análisis, modal más ancho, tabs en una línea |
| 2.1.2 | 15 Ene 2026 | PnL auditoría detallada, fix conversión GBX, comisiones desde transacciones, variación diaria consistente |
| 2.1.1 | 9 Ene 2026 | PWA instalable, ChatBot responsive, Auth screens responsive, nuevo logo |
| 2.1.0 | 8 Ene 2026 | Catálogo Maestro, Dashboard 2 columnas, Alertas globales, Mobile Navigation |
| 2.0.0 | Dic 2025 | Multi-AI, Discovery Engine v2, Position Analysis 6 tabs |

---

## ⚠️ Notas Importantes para IA

1. **JWT_SECRET**: Crítico para descifrar backups. Si se pierde, los backups cifrados son irrecuperables.
2. **Migraciones**: Se ejecutan automáticamente en `initDatabase()` al iniciar.
3. **Version**: Almacenada en `system_settings.APP_VERSION`, mostrada en modales via `useAuth().appVersion`.
4. **PWA**: Requiere HTTPS en producción (localhost funciona sin certificado).
5. **ChatBot**: Usa streaming via `ReadableStream` para respuestas de IA.
6. **FIFO**: Las ventas usan lógica FIFO estricta para cálculo de PnL.
7. **GBX**: Soporte automático de conversión peniques → libras para LSE.
8. **Timezone**: Todos los logs usan Europe/Madrid.
