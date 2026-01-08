# 🧠 Memoria del Proyecto: Stocks Manager

## 1. Identidad y Propósito
**Stocks Manager** es una aplicación web avanzada para la gestión de carteras de inversión personales, diseñada para ofrecer herramientas profesionales (Análisis Técnico, Métricas de Riesgo, IA) en una interfaz moderna y accesible.

*   **Versión Actual**: v2.1.0 (8 Enero 2026)
*   **Estado**: Producción / Estable.

## 2. Pila Tecnológica

### Backend
*   **Runtime**: Bun v1.2 (Speed focused)
*   **Framework**: ElysiaJS (High performance API)
*   **Base de Datos**: PostgreSQL 16 (con `postgres.js` client)
*   **Hash**: bcryptjs (contraseñas), Bun.hash (tokens)
*   **Email**: nodemailer (SMTP configurable)

### Frontend
*   **Framework**: React 18 + Vite
*   **Lenguaje**: TypeScript
*   **Estilos**: TailwindCSS v3.4 + CSS Modules
*   **Gráficos**: Recharts + Lightweight Charts (TradingView)

### Infraestructura
*   **Contenerización**: Docker & Docker Compose
*   **Logging Centralizado**:
    *   **Niveles**: PRODUCTION, STANDARD, VERBOSE, DEBUG
    *   **Persistencia**: Archivos diarios rotativos (`logs/app-YYYY-MM-DD.log`)
    *   **Formato**: Timestamps (Europe/Madrid), Tags de módulo, Colores
    *   **Gestión**: UI Admin para descarga, visualización y purga
*   **Proxy inverso recomendado**: Nginx / Cloudflare

### IA Multi-Provider
*   **Google Gemini**: Provider principal (SDK nativo)
*   **OpenRouter/Groq**: Providers OpenAI-compatible
*   **Ollama/LM Studio**: Providers locales sin API key
*   **Arquitectura**: Factory Pattern (`AIProviderFactory.ts`)

## 3. Arquitectura Modular

### 3.1. Gestión de Portafolios (`/portfolios`, `/positions`)
*   **Multi-Cartera**: Soporte ilimitado de portafolios por usuario.
*   **Transacciones**: Historial inmutable (BUY/SELL/DIVIDEND). Campos críticos:
    *   `amount`, `price_per_unit`, `fees` (comisión), `exchange_rate_to_eur`
*   **PnL Engine**: Cálculo en tiempo real (FIFO). Cacheo diario en `pnl_history_cache`.
*   **Soporte GBX**: Conversión automática de peniques a libras para mercado UK.
*   **Validación**: Sanitización de decimales (`,` → `.`), validación de tipos de cambio.

### 3.2. Datos de Mercado (`/market`)
*   **Proveedores**:
    *   **Yahoo Finance**: Datos tiempo real, histórico velas, fundamentales, búsquedas.
    *   **Finnhub**: Trending USA, noticias con sentiment.
    *   **EODHD**: Catálogo maestro de bolsas mundiales (74+ bolsas).
*   **Catálogo Maestro** (`global_tickers`):
    *   Bolsas configurables: NYSE, NASDAQ, AMEX, LSE, XETRA, MC, PA, HK, TO, NSE, AU, etc.
    *   Sincronización manual desde Admin → Mercado → Catálogo Maestro.
    *   Mapeo EODHD→Yahoo en `exchangeMapping.ts`.
*   **Discovery Engine (Crawler v2)**:
    *   **Split-World Strategy**: USA (Finnhub) vs Global (Yahoo Trending).
    *   **Regiones Dinámicas**: Lee `GLOBAL_TICKER_EXCHANGES` de configuración.
    *   **Marcado Inteligente**: Tickers fallidos se marcan con `yahoo_status='failed'`.

### 3.3. IA y Análisis (`/ai`)
*   **ChatBot Financiero**: Asistente contextual con conocimiento del portafolio.
*   **Personalidades**: System prompts configurables desde Admin.
*   **Análisis de Posición** (6 pestañas):
    1. **Posición**: Datos de cartera, peso, PnL.
    2. **Técnico**: RSI, SMA50/200, tendencia.
    3. **Riesgo**: Volatilidad, Sharpe, Sortino, MaxDrawdown, VaR95, Beta.
    4. **Fundamental**: PER, Beta, EPS, Fair Value (Graham Number).
    5. **Analistas**: Consenso, precio objetivo, insider sentiment.
    6. **What-If**: Simulador de compra/venta/cambio de precio.

### 3.4. Sistema de Alertas (`/alerts`)
*   **Tipos de Alerta**:
    *   Precio (above/below)
    *   Cambio porcentual
    *   RSI (sobrecompra/sobreventa)
    *   Cruce de SMA
    *   Volumen anómalo
*   **Alertas Globales de Portafolio** (`portfolio_alerts`):
    *   Monitorización del cambio diario total del portafolio.
    *   Cooldown por activo individual.
*   **Motor**: CronJob minutal con cooldown inteligente.

### 3.5. Administración (`/admin`)
*   **Pestañas**: General, IA, Mercado, Usuarios, Claves API, Backup, Estadísticas.
*   **Catálogo Maestro**: UI para seleccionar bolsas (NYSE, NASDAQ, AMEX, etc.).
*   **Cosecha Mundial**: Botón para sincronizar tickers de bolsas seleccionadas.
*   **Backups**: ZIP cifrado (AES-256), envío por email, programación (diario/semanal/mensual).
*   **Discovery Engine**: Configuración de ciclos, volúmenes V8/V10, Finnhub.
*   **Logs del Sistema**: Control total de logging (Nivel dinámico, Descarga de trazas, Limpieza).

## 4. Base de Datos (Schema - `init.sql`)

### Tablas Principales
| Tabla | Propósito |
|-------|-----------|
| `users` | Autenticación, 2FA, preferencias |
| `portfolios` | Carteras de inversión |
| `positions` | Posiciones abiertas por cartera |
| `transactions` | Historial inmutable de operaciones |
| `alerts` | Alertas de precio/técnicas |
| `portfolio_alerts` | Alertas globales de portafolio |
| `global_tickers` | Catálogo maestro (12k+ activos) |
| `market_cache` | Caché de datos de mercado (JSONB) |
| `market_discovery_cache` | Caché del Discovery Engine |
| `ticker_details_cache` | Datos detallados para modales |
| `position_analysis_cache` | Indicadores técnicos/riesgo |
| `pnl_history_cache` | Historial PnL diario |
| `system_settings` | Configuración clave-valor |
| `ai_providers` | Proveedores de IA configurados |
| `ai_prompts` | System prompts para ChatBot |
| `chat_conversations` / `chat_messages` | Historial de chat |
| `financial_events` | Calendario económico (Incluye `updated_at`, `estimated_eps`). |

### Campos Críticos en `transactions`
*   `amount`: Cantidad de unidades.
*   `price_per_unit`: Precio por unidad en moneda original.
*   `fees`: Comisión del broker.
*   `exchange_rate_to_eur`: Tipo de cambio al momento de la operación.

## 5. Jobs Programados (CronJobs)

| Job | Frecuencia | Función |
|-----|------------|---------|
| `pnlJob` | Diario (6:00 UTC) | Calcula historial PnL |
| `discoveryJob` | Configurable | Crawler Split-World |
| `catalogEnrichmentJob` | Configurable | Enriquece `global_tickers` con datos V10 |
| `positionAnalysisJob` | Semanal | Actualiza análisis en caché |
| `backupJob` | Configurable | Backups automáticos |

## 6. Estructura de Archivos Clave

### Backend (`/server`)
```
server/
├── index.ts              # Punto de entrada Elysia
├── db.ts                 # Conexión PostgreSQL
├── routes/
│   ├── auth.ts           # Login, Registro, 2FA
│   ├── portfolios.ts     # CRUD Portafolios
│   ├── market.ts         # Datos de mercado
│   ├── ai.ts             # ChatBot y análisis
│   ├── alerts.ts         # Sistema de alertas
│   └── admin.ts          # Panel administración
├── services/
│   ├── marketData.ts     # Cliente Yahoo/Finnhub
│   ├── eodhdService.ts   # Cliente EODHD
│   ├── aiService.ts      # Orquestador LLMs
│   ├── portfolioService.ts
│   ├── discoveryService.ts
│   └── backupService.ts
├── jobs/
│   ├── pnlJob.ts
│   ├── discoveryJob.ts
│   └── backupJob.ts
└── utils/
    └── exchangeMapping.ts  # Mapeo EODHD→Yahoo
```

### Frontend (`/src`)
```
src/
├── App.tsx               # Router principal
├── screens/
│   ├── Dashboard.tsx     # Vista principal (2 columnas)
│   ├── PortfolioScreen.tsx
│   ├── AdminScreen.tsx
│   └── AlertsScreen.tsx
├── components/
│   ├── Sidebar.tsx
│   ├── ChatBot.tsx
│   ├── PositionAnalysisModal.tsx
│   └── admin/
│       ├── MasterCatalogConfig.tsx
│       └── DataExplorerTable.tsx
└── context/
    ├── AuthContext.tsx
    └── ToastContext.tsx
```

## 7. Variables de Entorno (`.env`)

```env
# Base de Datos
DB_HOST=db
DB_PORT=5432
DB_NAME=stocks_manager
DB_USER=admin
DB_PASSWORD=securepassword

# Seguridad
JWT_SECRET=your_jwt_secret

# APIs Externas
FINNHUB_API_KEY=xxx
EODHD_API_KEY=xxx
GOOGLE_GENAI_API_KEY=xxx

# SMTP (Opcional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user
SMTP_PASSWORD=pass
SMTP_FROM=noreply@example.com
```

## 8. Comandos de Operación

```bash
# Desarrollo
bun run dev

# Build & Deploy
docker compose up -d --build

# Verificar versión
docker exec stocks_app grep '"version":' package.json

# Limpiar caché Nginx
rm -rf /var/cache/nginx/*

# Tests
bun run test
```

## 9. Notas de Despliegue
*   **Cache Busting**: Limpiar cachés CDN/Nginx tras cada despliegue.
*   **Multi-stage Build**: Dockerfile optimizado (builder → release).
*   **Volúmenes Docker**: `postgres_data` (DB), `stock_uploads` (avatares).
*   **2FA**: TOTP compatible con Google Authenticator.
*   **Primer Usuario**: Se convierte automáticamente en admin.
