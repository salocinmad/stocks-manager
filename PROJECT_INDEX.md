# 🗂️ Índice Maestro del Proyecto Stocks Manager

Este documento es la **fuente de verdad** sobre la estructura, arquitectura y funcionalidad de cada archivo en el proyecto. Está diseñado para que cualquier agente de IA o desarrollador pueda obtener una comprensión profunda del sistema en minutos.

---

## 🏗️ 1. Inicialización de Base de Datos (Crítico)
Estos archivos definen la estructura de datos. **Cualquier cambio en el modelo de datos debe reflejarse aquí.**

- **`i:\dev\stocks-manager\init.sql`**
    - **Tipo**: Script SQL (PostgreSQL).
    - **Propósito**: Define el esquema base para inicializaciones externas. Contiene las **23 tablas** del sistema, incluyendo `market_cache` (con `updated_at`), `global_tickers` (con columnas `yahoo_status`, `yahoo_error` para marcado de tickers fallidos), `ticker_details_cache` (datos profundos para Discovery), `pnl_history_cache`, `position_analysis_cache`, y **seeds iniciales** en `system_settings` (`APP_VERSION`).
    - **Uso**: Referencia principal del esquema relacional y paridad con `init_db.ts`.

- **`i:\dev\stocks-manager\server\init_db.ts`**
    - **Tipo**: Script TypeScript (Ejecución automática).
    - **Propósito**: **Gestor de arranque y migraciones**. Se ejecuta cada vez que inicia el servidor (`index.ts`).
    - **Funciones**:
        - Verifica conexión a PostgreSQL.
        - Aplica **migraciones evolutivas** (ej. añadir columnas `estimated_eps` a `financial_events` si no existen).
        - **Siembra datos** (Seed): Crea proveedores de IA por defecto (Gemini, OpenRouter), usuario administrador inicial y configuración base (`APP_VERSION`).
    - **Importancia**: Es el mecanismo de "Auto-Migración" del sistema.

---

## ⚙️ 2. Configuración y Raíz
Archivos que controlan el entorno de ejecución y construcción.

- **`package.json`**: Gestor de dependencias (Bun). Scripts principales: `dev` (backend auto-reload), `build:frontend` (Vite), `start` (prod).
- **`docker-compose.yml`**: Orquestación. Define servicio `app` (Puerto 3000) y `db` (PostgreSQL 16). Gestiona volúmenes persistentes.
- **`vite.config.ts`**: Configuración de compilación del Frontend (React). Define alias y proxies.
- **`tailwind.config.js`**: Sistema de diseño. Configuración de colores corporativos (`primary`, `background-dark`), fuentes y plugins.
- **`tsconfig.json`**: Reglas de TypeScript (Strict mode, paths).

---

## 🖥️ 3. Backend (`server/`)
Arquitectura basada en **Bun** + **ElysiaJS**.

### 🧠 Core
- **`index.ts`**: **Punto de Entrada**. Inicializa servidor Web, Swagger, CORS, Cron Jobs (`CalendarJob`, `DiscoveryJob`) y monta el enrutador principal en `/api`.
- **`db.ts`**: Capa de acceso a datos. Instancia singleton del cliente `postgres.js`.

### 🛠️ Servicios (`server/services/`)
Lógica de negocio pura. Independiente del transporte HTTP.
- **`aiService.ts`**: **Cerebro de IA**. 
    - Gestiona proveedores dinámicos (Gemini, OpenAI, Ollama).
    - Construye prompts complejos inyectando contexto financiero (`{{MARKET_DATA}}`) y noticias.
    - Maneja límites de tokens y reintentos.
- **`calculations.ts`**: **Motor Matemático**. (v2.1.0)
    - Librería pura de funciones financieras y técnicas.
    - Calcula RSI, SMA, Volatilidad, Sharpe, Altman Z-Score y Valoración.
    - Usado por `marketData.ts` y `positionAnalysisService.ts`.
- **`authService.ts`**: Seguridad. Registro, Login, Refresh Tokens, Hashing (bcrypt).
- **`backupService.ts`**: **Sistema de Respaldo**. Genera ZIPs (con `archiver`) encriptados y DB Dumps. Gestiona la restauración con `unzipper`.
- **`calendarService.ts`**: **Calendario Financiero**. Sincroniza eventos de ganancias y dividendos usando `yahoo-finance2` (V3) con ventana de 30 días.
- **`discoveryService.ts`**: **Discovery Engine**. CRUD para la caché de oportunidades de mercado (`market_discovery_cache`). Soporta filtrado serverside avanzado (ej. `chicharros`) y ordenación dinámica por múltiples criterios.
- **`eodhdService.ts`**: **Librería Global (Harvesting)**. Servicio encargado de sincronizar la lista maestra de tickers mundiales desde EOD Historical Data. Maneja ISINs, filtrado de bolsas (excluyendo USA), filtrado por tipo (**solo 'Common Stock'**) y ahorro de créditos (rate limiting).
    - **Tabla asociada**: `global_tickers` (almacena símbolos, nombres, ISINs, bolsas, etc. de tickers mundiales).
### CATÁLOGO MAESTRO (GLOBAL TICKERS)
- `server/services/eodhdService.ts`: Servicio para la sincronización de la librería global de tickers desde EODHD (solo "Common Stock").
- `server/jobs/globalTickerJob.ts`: Job mensual para actualizar el catálogo maestro.
- **`marketData.ts`**: **Proveedor de Datos Unificado**.
    - **Estrategia Principal**: Utiliza Yahoo Finance (V8/V10) con el método **Search + Enrich** como fuente primaria.
    - **Cache de MarketStatus**: Solo 1 llamada a Yahoo por minuto para estado de mercados (optimización v2.3.0). Todos los navegadores comparten el mismo cache.
    - **ISIN Fallback**: Implementa estrategia de rescate. Si un ticker no se encuentra, busca por su ISIN (de `global_tickers`) para encontrar el símbolo correcto automáticamente.
    - **Alternativas**: Finnhub se mantiene como proveedor alternativo para perfiles de empresa o noticias si las APIs de Yahoo no están disponibles o se solicita explícitamente. EOD Historical Data (EODHD) se usa para la sincronización global de tickers y puede complementar o reemplazar a Finnhub para datos de perfil o fundamentales en el futuro.
    - **Soporte Multi-divisa**: Normaliza automáticamente `GBX` (LSE) y soporta dinámicamente cualquier divisa de mercado (ej. MXN, CAD) mediante la descarga masiva de cotizaciones V7/V8 tras la búsqueda inicial.
    - Repara y normaliza respuestas de múltiples versiones de API para mantener la consistencia del sistema.
- **`newsService.ts`**: Noticias. Busca noticias financieras relevantes filtrando por ticker.
- **`notificationService.ts`**: Canales. Orquesta envío de alertas por Email o Telegram.
- **`pnlService.ts`**: **Motor Matemático**. Calcula PnL (Realizado/No Realizado), ROI, Costo Base y métricas de cartera agregadas.
- **`portfolioService.ts`**: Gestión de Activos. CRUD de carteras, transacciones y validación de operaciones.
- **`settingsService.ts`**: Configuración dinámica. Lee/Escribe variables en `.env` y gestiona flags de características (ej. `CRAWLER_ENABLED`).
- **`smtpService.ts`**: Transporte de Email. Wrapper de `nodemailer`.
- **`twoFactorService.ts`**: 2FA. Generación/Validación de TOTP (`otpauth`).
- **`positionAnalysisService.ts`**: **Análisis de Posición** (v2.1.0). Calcula métricas de riesgo (Sharpe, Sortino, MaxDrawdown, Beta, VaR95%), simulaciones What-If y obtiene datos de analistas. Usa caché en `position_analysis_cache`.
- **`portfolioAlertService.ts`**: **Alertas de Portfolio** (v2.1.0/v2.4.0). Alertas a nivel de cartera completa (PnL, valor total) y **Alertas Globales de Activos** (`any_asset_change_percent`), que monitorean cambios diarios en cada posición individualmente.

### 🛣️ Rutas API (`server/routes/`)
Controladores HTTP REST. Mapean requests a llamadas de servicios.
- **`auth.ts`**: Autenticación (`POST /login`, `/register`).
- **`admin.ts`**: Panel Admin (`GET /users`, `POST /backup/schedule`, `GET /backup/zip`).
- **`ai.ts`**: Chat (`POST /chat`), Gestión Proveedores (`GET/POST /providers`).
- **`calendar.ts`**: Calendario (`GET /events`, `POST /sync`, `GET /market`).
- **`dashboard.ts`**: Resumen (`GET /summary`).
- **`discovery.ts`**: Discovery (`GET /candidates`).
- **`market.ts`**: Mercado (`GET /quote/:ticker`, `GET /search`).
- **`notifications.ts`**: Alertas Config (`GET/POST /channels`).
- **`portfolios.ts`**: Transacciones (`GET :id`, `POST /transaction`).
- **`reports.ts`**: Fiscalidad (`GET /tax-report`).
- **`alerts.ts`**: Alertas Unificadas (`GET/POST /alerts`). Soporta alertas individuales (`price`, `volume`, `rsi`) y Globales de Portfolio (`any_asset_change_percent`) con enrutamiento inteligente a tablas `alerts` o `portfolio_alerts`. Incluye endpoint de reseteo (`PUT /:id/reset`) que limpia `triggered_assets`.
- **`analysis.ts`**: **Análisis de Posición** (v2.1.0). Endpoints: `GET /analysis/position/:id`, `POST /analysis/simulate/{buy,sell,price-change}`, `POST /analysis/refresh/:id`.

### ⏱️ Cron Jobs (`server/jobs/`)
Tareas programadas en `index.ts`.
### ⏱️ Cron Jobs (`server/jobs/`)
Taras programadas en `index.ts`.
- **`calendarJob.ts`**: (Cada 6h) Sincroniza eventos financieros. *Espera inteligente* si el Crawler corrió hace poco.
- **`discoveryJob.ts`**: (**Ciclos Dinámicos / 3m tick**) **Crawler Inteligente**.
    - Ejecuta workers (V8/V10/Finnhub) en paralelo.
    - Respeta configuración granular (Ciclos/hora, Volúmenes).
    - Detecta "Market Open" para priorizar Day Gainers.
- **`catalogEnrichmentJob.ts`**: (**Segundo plano / Admin**) **Motor de Enriquecimiento**.
    - Recorre sistemáticamente el `catalogo global` para enriquecer datos de `market_discovery_cache`.
    - Gestiona presupuesto de llamadas API (ej. 20/ciclo) y reutiliza históricos frescos (< 2 días).
    - Implementa lógica de rescate por ISIN y **persistencia incremental (Append)** para evitar pérdida de datos.
    - **Marcado de Tickers Fallidos**: Detecta errores permanentes (`Quote not found`, `internal-error`) y marca los tickers en `yahoo_status='failed'` para saltarlos automáticamente en futuros ciclos.
- **`backupJob.ts`**: (Programable/Manual) Ejecuta backups automáticos, cifra el archivo (ZIP) y lo envía por email. Gestiona límites de tamaño.
- **`positionAnalysisJob.ts`**: (Cada 6h: 00:00, 06:00, 12:00, 18:00) **Análisis Técnico** (v2.1.0). Precalcula RSI, SMA, métricas de riesgo para todas las posiciones activas. Almacena en `position_analysis_cache`.
- **`globalTickerJob.ts`**: (**1 de cada mes**) **Sincronización Mundial**. Actualiza la tabla `global_tickers` descargando listas completas de 20 bolsas internacionales desde EODHD.

### 📜 Scripts (`server/scripts/`)
Utilidades de mantenimiento, migración y depuración.
*Más de 50 scripts disponibles. Los más relevantes:*
- **Migración/Mantenimiento**: `migrate_ai_providers.ts`, `fix_schema.ts`, `cleanup_test_users.ts`, `run_migration.ts`.
- **Depuración Datos**: `debug_finnhub.ts`, `debug_yf.ts`, `check_discovery.ts`, `inspect_schema.ts`.
- **Manuales**: `run_crawler_manual.ts` (Fuerza ejecución crawler), `manual_sync_5y.ts`.
- **Pruebas Aisladas**: `test_yahoo_v3.ts`, `verify_news_order.ts`.

### 🧪 Tests (`server/tests/`)
Pruebas de integración y unidad (Ejecutar con `docker compose exec app bun test`).
- **`auth.test.ts`**: Autenticación 2FA, generación de códigos de respaldo y limpieza de usuarios.
- **`password_reset.test.ts`**: Flujo completo de recuperación de contraseña (Token, Expiración, Hashing).
- **`alerts.test.ts`**: Motor de alertas. Verifica disparadores de precio (Above/Below) y notificaciones simuladas.
- **`market.test.ts`**: Integración de Datos. Valida caché, mocks de Yahoo Finance y manejo de errores 404.
- **`pnl.service.test.ts`**: Test Unitario puro. Cálculo matemático de Ganancias/Pérdidas (Realizado vs No Realizado).
- **`pnl.test.ts`**: Test de Integración (Job). Simula la ejecución diaria del cálculo de PnL histórico.
- **`portfolio.logic.test.ts`**: Reglas de Negocio. Precio medio ponderado, FIFO (simplificado) y cálculo de comisiones.
- **`portfolio.test.ts`**: Placeholder para futuros tests de controladores de portafolio.
- **`setup.ts`**: Configuración global de entorno de pruebas (Variables, Mocks iniciales).
- **`test_debug.log`**: Log detallado (stack trace completo) de la última ejecución. Se regenera en cada test run.
- **`portfolio_global_alerts.test.ts`**: (v2.4.0) Test de integración para Alertas Globales. Verifica disparo de alertas por activo y gestión de cooldowns (`triggered_assets`).

---

## 🎨 4. Frontend (`src/`)
SPA construida con **React 19**, **Vite** y **TailwindCSS**.

### 🧩 Contexto (`src/context/`)
- **`AuthContext.tsx`**: Estado global de sesión. Provee `user`, `login()`, `logout()`, `isAdmin`.
- **`ToastContext.tsx`**: **Sistema de Notificaciones**. Provee `useToast()` para mostrar alertas no intrusivas (Success/Error/Info) en toda la app. Reemplaza a `alert()`.

### 📱 Pantallas (`src/screens/`)
Vistas principales (Rutas).
- **`Dashboard.tsx`**: Home. **Layout de 2 columnas** (v2.1.0): Columna principal (75%) con 3 stats cards, AI Insight (condicional), Top Movers y Gráfico PnL. Columna lateral (25%) con botón Análisis IA y gráfico de Distribución por Sector. Implementa Skeleton UI y selector de portafolio "Premium Dropdown".
- **`CalendarScreen.tsx`**: **Calendario Financiero**. Vista mensual, toggles Mercado/Portfolio.
- **`PortfolioScreen.tsx`**: Gestión de inversiones. Tabla de activos, desglose monedas.
- **`MarketDataService.tsx`** vs **`marketData.ts`**: Frontend = API Wrapper (`/api/market/...`), Backend = Core Logic.
    - **`MarketIndicesSelector.tsx`**: (v2.1.1) Selector administrativo para personalizar los índices globales de la cabecera. Gestiona persistencia y estandarización de nombres (ej. "IBEX 35 (Spain)").
- **`MarketAnalysis.tsx`**: Screener técnico y gráficos.
- **`NewsScreen.tsx`**: Lector de noticias financieras.

### 🧩 Screens (Páginas)
    - **`AdminScreen.tsx`**: Panel de Control.
    - **Tabs**: General (Config, SMTP, **Alarmas**), Inteligencia Artificial, Usuarios, Mercado, Backup, Logs.
    - **Tab General**: Gestión centralizada de configuración, correo y **Acciones de Emergencia** (Reset de Alertas).
    - **Tab Mercado (Reorganizado v2.1.0)**: Contiene 3 subtabs:
      - **Sincronización**: Sync manual, PnL, Librería Global, Enriquecimiento, Zona de Peligro.
      - **Índices de Cabecera**: Selector de índices globales para la cabecera (`MarketIndicesSelector`).
      - **Discovery Engine**: Control maestro, Presets, Ajustes granulares (sliders hasta 80 items).
- **`ReportsScreen.tsx`**: Generador de informes fiscales (FIFO).
- **`ProfileScreen.tsx`**: Seguridad (2FA), Avatar.
- **`LoginScreen.tsx` / `RegisterScreen.tsx`**: Entrada.

### 🧩 Componentes (`src/components/`)
Bloques UI reutilizables.
- **`Sidebar.tsx`**: Navegación principal **Agrupada** (Principal, Mercados, Sistema) con estética **Glassmorphism**.
- **`Header.tsx`**: Cabecera Global unificada. Contiene **`Breadcrumbs`** y Ticker de Mercado estable.
- **`Breadcrumbs.tsx`**: (v2.2.0) Navegación jerárquica basada en rutas.
- **`ChatBot.tsx`**: **Asistente Flotante**. Interfaz de chat con la IA. Envía contexto de la pantalla actual.
- **`PnLChart.tsx`**: Gráfico de área (Recharts) para evolución de patrimonio.
- **`TradingViewChart.tsx`**: Widget ligero de TradingView.
- **`StockNoteModal.tsx`**: Editor de notas para posiciones.
- **`ThemeSwitcher.tsx`**: Control Modo Claro/Oscuro.
- **`PositionAnalysisModal.tsx`**: **Panel de Análisis** (v2.1.0). Modal rediseñado (Estilo "Green Leader") con consistencia visual total con Discovery. **6 pestañas**: Posición, Técnico, Riesgo, **Fundamental**, Analistas, What-If. Footer con versión dinámica.
- **`SplitViewJsonModal.tsx`**: **Dashboard de Auditoría** (v2.1.0). Modal de inspección profunda para `Discovery Engine`. Transformado en un Dashboard con 4 tarjetas (General, Riesgo, Mercado, Técnico) y gráfica sparkline. Incluye tooltips de glosario.
- **`KeyboardShortcutsProvider.tsx`**: **Atajos de Teclado** (v2.1.0). Provider global. Hotkeys: `Ctrl+K` (búsqueda), `Ctrl+D/A/P/W/N` (navegación), `?` (ayuda).
- **`GlobalSearchModal.tsx`**: **Búsqueda Global** (v2.1.0). Command Palette estilo Spotlight. Busca pantallas, tickers y carteras.
- **`DataExplorerTable.tsx`**: **Tabla del Explorador** (v2.1.0). Tabla avanzada para el Explorador de Mercado con paginación dinámica, ordenación por columnas, nueva columna "Precio Obj" y filtro especializado "Posibles Chicharros".

### 💀 Skeletons (`src/components/skeletons/`)
Componentes de carga visual (v2.2.0).
- **`DashboardSkeleton.tsx`**: Estructura pulsante (`animate-pulse`) del Dashboard para carga inicial.

---

## 📚 5. Documentación
Referencia para humanos.
- **`README.md`**: Visión general y "Quick Start".
- **`MANUAL_USUARIO.md`**: Guía paso a paso funcional.
- **`GUIA_ADMINISTRADOR.md`**: Guía técnica de despliegue y config.
- **`RELEASE_NOTES.md`**: Changelog (v2.1.0 actual).
- **`PROJECT_INDEX.md`**: (Este archivo) Índice técnico maestro.

---

## 🐳 6. Ejecución y Pruebas (Docker)

⚠️ **CRÍTICO: SISTEMA SIN BUN LOCAL Y ENTORNO WINDOWS**

1. **ENTORNO HOST**: Este proyecto reside en un sistema **Windows**. Por lo tanto, todos los comandos de terminal mostrados abajo deben ejecutarse preferiblemente en **PowerShell**. Evita usar comandos típicos de Linux (como `grep`) directamente en el host para no generar errores de sintaxis; usa las alternativas de PowerShell (ej. `Select-String`) si es necesario, o ejecútalos dentro de `docker compose exec`.
2. **SIN BUN LOCAL**: El entorno host **NO TIENE BUN INSTALADO**. Cualquier intento de ejecutar `bun install` o `bun run` fuera de Docker fallará.
3. **PERSISTENCIA DE CAMBIOS**: Debido a que el frontend se sirve desde una carpeta `dist` compilada dentro de la imagen, **CUALQUIER CAMBIO EN EL CÓDIGO (Frontend o Backend) REQUIERE RECONSTRUIR EL CONTENEDOR** para ser efectivo. Los cambios locales no se reflejarán en el navegador si no se ejecuta el build de Docker.

**OBLIGATORIO**: Todas las interacciones, pruebas y scripts deben ejecutarse DENTRO del contenedor Docker.

### Comandos Esenciales (Verificados)

**1. Desplegar / Actualizar el Entorno (Obligatorio tras cambios de código)**
```powershell
# Este comando es el único que garantiza que tus cambios locales de código se apliquen al Docker
docker compose up -d --build
```

**2. Ejecutar Tests**
```bash
docker compose exec app bun test
```
*Esto corre la suite de pruebas dentro del contenedor `stocks_app`.*

**3. Ver Logs de Debug de Tests**
```bash
docker compose exec app cat server/tests/test_debug.log
```

**4. Ejecutar un Script de Mantenimiento (.ts/.js)**
```bash
# Ejemplo: Verificar el esquema de la base de datos
docker compose exec app bun run server/scripts/check_schema.ts
```

**5. Consultar la Base de Datos Directamente**
```bash
# Ejemplo: Contar usuarios registrados
docker compose exec db psql -U admin -d stocks_manager -c "SELECT count(*) FROM users;"
```

**6. Ver Logs del Contenedor**
```bash
# Últimas 100 líneas de logs de la aplicación
docker compose logs app --tail 100

# Logs en tiempo real (seguimiento)
docker compose logs app -f
```

**7. Detener el Entorno**
```bash
docker compose down
```

### 8. Gestión de la Versión del Proyecto
La versión de la aplicación **NO** está hardcodeada en el frontend. Se gestiona centralizadamente en la base de datos (`system_settings`).

**Para cambiar la versión:**
1. Accede a la base de datos (vía cliente SQL o `docker compose exec db psql`).
2. Ejecuta el comando SQL:
   ```sql
   UPDATE system_settings SET value = 'V2.X.X' WHERE key = 'APP_VERSION';
   ```
3. Reinicia el navegador. La nueva versión aparecerá en el Sidebar.
