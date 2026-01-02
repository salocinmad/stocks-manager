# 🗂️ Índice Maestro del Proyecto Stocks Manager

Este documento es la **fuente de verdad** sobre la estructura, arquitectura y funcionalidad de cada archivo en el proyecto. Está diseñado para que cualquier agente de IA o desarrollador pueda obtener una comprensión profunda del sistema en minutos.

---

## 🏗️ 1. Inicialización de Base de Datos (Crítico)
Estos archivos definen la estructura de datos. **Cualquier cambio en el modelo de datos debe reflejarse aquí.**

- **`i:\dev\stocks-manager\init.sql`**
    - **Tipo**: Script SQL (PostgreSQL).
    - **Propósito**: Define el esquema base si se inicializa la DB desde cero externamente. Contiene `CREATE TABLE` para `users`, `portfolios`, `transactions`, `stock_notes`, `financial_events`, etc.
    - **Uso**: Referencia principal del esquema relacional.

- **`i:\dev\stocks-manager\server\init_db.ts`**
    - **Tipo**: Script TypeScript (Ejecución automática).
    - **Propósito**: **Gestor de arranque y migraciones**. Se ejecuta cada vez que inicia el servidor (`index.ts`).
    - **Funciones**:
        - Verifica conexión a PostgreSQL.
        - Aplica **migraciones evolutivas** (ej. añadir columnas `estimated_eps` a `financial_events` si no existen).
        - **Siembra datos** (Seed): Crea proveedores de IA por defecto (Gemini, OpenRouter) y el usuario administrador inicial.
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
- **`authService.ts`**: Seguridad. Registro, Login, Refresh Tokens, Hashing (bcrypt).
- **`backupService.ts`**: **Sistema de Respaldo**. Genera ZIPs (con `archiver`) encriptados y DB Dumps. Gestiona la restauración con `unzipper`.
- **`calendarService.ts`**: **Calendario Financiero**. Sincroniza eventos de ganancias y dividendos usando `yahoo-finance2` (V3) con ventana de 30 días.
- **`discoveryService.ts`**: **Discovery Engine**. CRUD para la caché de oportunidades de mercado (`market_discovery_cache`).
- **`marketData.ts`**: **Proveedor de Datos Unificado**.
    - Patrón Facade sobre Yahoo Finance (V7/V8/V10) y Finnhub (ahora opcional para estado).
    - Obtiene precios, fundamentales profundos y estado del mercado (vía `quoteSummary` V10).
    - Repara y normaliza respuestas de múltiples versiones de API.
- **`newsService.ts`**: Noticias. Busca noticias financieras relevantes filtrando por ticker.
- **`notificationService.ts`**: Canales. Orquesta envío de alertas por Email o Telegram.
- **`pnlService.ts`**: **Motor Matemático**. Calcula PnL (Realizado/No Realizado), ROI, Costo Base y métricas de cartera agregadas.
- **`portfolioService.ts`**: Gestión de Activos. CRUD de carteras, transacciones y validación de operaciones.
- **`settingsService.ts`**: Configuración dinámica. Lee/Escribe variables en `.env` y gestiona flags de características (ej. `CRAWLER_ENABLED`).
- **`smtpService.ts`**: Transporte de Email. Wrapper de `nodemailer`.
- **`twoFactorService.ts`**: 2FA. Generación/Validación de TOTP (`otpauth`).
- **`positionAnalysisService.ts`**: **Análisis de Posición** (v2.1.0). Calcula métricas de riesgo (Sharpe, Sortino, MaxDrawdown, Beta, VaR95%), simulaciones What-If y obtiene datos de analistas. Usa caché en `position_analysis_cache`.
- **`portfolioAlertService.ts`**: **Alertas de Portfolio** (v2.1.0). Alertas a nivel de cartera completa: PnL (€/%), valor total, exposición sectorial.

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
- **`alerts.ts`**: Alertas Precio (`GET/POST /alerts`). Ahora soporta tipos: `price`, `percent_change`, `volume`, `rsi`, `sma_cross`.
- **`analysis.ts`**: **Análisis de Posición** (v2.1.0). Endpoints: `GET /analysis/position/:id`, `POST /analysis/simulate/{buy,sell,price-change}`, `POST /analysis/refresh/:id`.

### ⏱️ Cron Jobs (`server/jobs/`)
Tareas programadas en `index.ts`.
- **`calendarJob.ts`**: (Cada 6h) Sincroniza eventos financieros. *Espera inteligente* si el Crawler corrió hace poco.
- **`discoveryJob.ts`**: (**Ciclos Dinámicos / 3m tick**) **Crawler Inteligente**.
    - Ejecuta workers (V8/V10/Finnhub) en paralelo.
    - Respeta configuración granular (Ciclos/hora, Volúmenes).
    - Detecta "Market Open" para priorizar Day Gainers.
- **`backupJob.ts`**: (Programable/Manual) Ejecuta backups automáticos, cifra el archivo (ZIP) y lo envía por email. Gestiona límites de tamaño.
- **`positionAnalysisJob.ts`**: (Cada 6h: 00:00, 06:00, 12:00, 18:00) **Análisis Técnico** (v2.1.0). Precalcula RSI, SMA, métricas de riesgo para todas las posiciones activas. Almacena en `position_analysis_cache`.

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

---

## 🎨 4. Frontend (`src/`)
SPA construida con **React 19**, **Vite** y **TailwindCSS**.

### 🧩 Contexto (`src/context/`)
- **`AuthContext.tsx`**: Estado global de sesión. Provee `user`, `login()`, `logout()`, `isAdmin`.

### 📱 Pantallas (`src/screens/`)
Vistas principales (Rutas).
- **`Dashboard.tsx`**: Home. Resumen de patrimonio, gráficos PnL y Discovery widget.
- **`CalendarScreen.tsx`**: **Calendario Financiero**. Vista mensual, toggles Mercado/Portfolio.
- **`PortfolioScreen.tsx`**: Gestión de inversiones. Tabla de activos, desglose monedas.
- **`MarketAnalysis.tsx`**: Screener técnico y gráficos.
- **`NewsScreen.tsx`**: Lector de noticias financieras.
- **`AdminScreen.tsx`**: **Panel de Control**.
    - Pestañas: General (Crawler), IA (Proveedores), Usuarios, Backups.
- **`ReportsScreen.tsx`**: Generador de informes fiscales (FIFO).
- **`ProfileScreen.tsx`**: Seguridad (2FA), Avatar.
- **`LoginScreen.tsx` / `RegisterScreen.tsx`**: Entrada.

### 🧩 Componentes (`src/components/`)
Bloques UI reutilizables.
- **`Sidebar.tsx`**: Navegación principal.
- **`ChatBot.tsx`**: **Asistente Flotante**. Interfaz de chat con la IA. Envía contexto de la pantalla actual.
- **`PnLChart.tsx`**: Gráfico de área (Recharts) para evolución de patrimonio.
- **`TradingViewChart.tsx`**: Widget ligero de TradingView.
- **`StockNoteModal.tsx`**: Editor de notas para posiciones.
- **`ThemeSwitcher.tsx`**: Control Modo Claro/Oscuro.
- **`PositionAnalysisModal.tsx`**: **Panel de Análisis** (v2.1.0). Modal grande (80% viewport) con **6 pestañas**: Posición, Técnico, Riesgo, **Fundamental**, Analistas, What-If. Incluye tooltips explicativos en todas las métricas.
- **`KeyboardShortcutsProvider.tsx`**: **Atajos de Teclado** (v2.1.0). Provider global. Hotkeys: `Ctrl+K` (búsqueda), `Ctrl+D/A/P/W/N` (navegación), `?` (ayuda).
- **`GlobalSearchModal.tsx`**: **Búsqueda Global** (v2.1.0). Command Palette estilo Spotlight. Busca pantallas, tickers y carteras.

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

⚠️ **CRÍTICO: SISTEMA SIN BUN LOCAL**

El entorno de desarrollo donde reside este código **NO TIENE BUN INSTALADO**.
Cualquier intento de ejecutar `bun install`, `bun test` o `bun run` directamente en tu terminal local **FALLARÁ**.

**OBLIGATORIO**: Todas las interacciones, pruebas y scripts deben ejecutarse DENTRO del contenedor Docker.

Todas las interacciones con el entorno de desarrollo, ejecución de tests y scripts de mantenimiento deben realizarse a través de `docker compose`.

### Comandos Esenciales (Verificados)

**1. Desplegar el Entorno**
```bash
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
