# 🗂️ Índice Maestro del Proyecto Stocks Manager

Este documento es la **fuente de verdad** sobre la estructura, arquitectura y funcionalidad de cada archivo en el proyecto. Está diseñado para que cualquier agente de IA o desarrollador pueda obtener una comprensión profunda del sistema en minutos.

---

## 🏗️ 1. Inicialización de Base de Datos (Crítico)
Estos archivos definen la estructura de datos. **Cualquier cambio en el modelo de datos debe reflejarse aquí.**

- **`i:\dev\stocks-manager\init.sql`**
    - **Tipo**: Script SQL (PostgreSQL).
    - **Propósito**: Define el esquema base para inicializaciones externas. Contiene las **23 tablas** del sistema:
      1. `users`: Usuarios y seguridad.
      2. `password_resets`: Tokens de recuperación.
      3. `portfolios`: Carteras.
      4. `positions`: Activos en posesión.
      5. `transactions`: Historial de operaciones.
      6. `watchlists`: Listas de seguimiento.
      7. `alerts`: Alertas técnicas y de precio.
      8. `notification_channels`: Configuración de notificaciones.
      9. `system_settings`: KV Store global.
      10. `historical_data`: Precios diarios.
      11. `position_notes`: Notas Markdown.
      12. `market_cache`: Cache de mercado.
      13. `financial_events`: Dividendos y Earnings.
      14. `ai_prompts`: Plantillas de sistema.
      15. `ai_providers`: Configuración de LLMs.
      16. `chat_conversations`: Historial.
      17. `chat_messages`: Mensajes.
      18. `pnl_history_cache`: Gráfico de patrimonio.
      19. `market_discovery_cache`: Discovery Engine.
      19.5 `ticker_details_cache`: Datos profundos.
      20. `global_tickers`: Catálogo maestro mundial.
      21. `position_analysis_cache`: Métricas de riesgo (Sharpe/VaR).
      22. `portfolio_alerts`: Alertas globales de cartera.
    - **Uso**: Referencia principal del esquema relacional y paridad con `init_db.ts`.

- **`i:\dev\stocks-manager\server\init_db.ts`**
    - **Tipo**: Script TypeScript (Ejecución automática).
    - **Propósito**: **Gestor de arranque y migraciones**. Se ejecuta cada vez que inicia el servidor (`index.ts`).
    - **Funciones**:
        - Verifica conexión a PostgreSQL.
        - Aplica **migraciones evolutivas** (ej. `position_analysis_cache`, `ai_providers`).
        - **Siembra datos** (Seed): Crea proveedores por defecto (Gemini, OpenRouter, Ollama) y usuario admin.

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
- **`aiService.ts`**: **Cerebro de IA**. Gestiona proveedores dinámicos (Gemini, OpenAI, Ollama Local).
- **`authService.ts`**: Seguridad. Registro, Login, Refresh Tokens, Hashing (bcrypt).
- **`backupService.ts`**: **Sistema de Respaldo Optimizado**. Genera ZIPs usando **Stream-to-Disk** para evitar OOM.
- **`calendarService.ts`**: **Calendario Financiero**. Sincroniza eventos de ganancias y dividendos.
- **`discoveryService.ts`**: **Discovery Engine**. CRUD para la caché de oportunidades de mercado.
- **`eodhdService.ts`**: **Librería Global**. Sincroniza `global_tickers` desde EODHD (70k+ tickers).
- **`marketData.ts`**: **Proveedor de Datos Unificado**.
    - Fuente primaria: Yahoo Finance V10.
    - **UX**: Normaliza estados `POSTPOST`/`PREPRE` a `CLOSED`.
    - **GBX**: Soporte para peniques británicos.
- **`pnlService.ts`**: **Motor Matemático**. Calcula PnL (Realizado/No Realizado), ROI, Costo Base.
- **`portfolioService.ts`**: Gestión de Activos. CRUD de carteras, transacciones.
- **`settingsService.ts`**: Configuración dinámica KV.
- **`positionAnalysisService.ts`**: **Análisis de Riesgo**. Calcula Sharpe, Sortino, VaR95% y Beta.

### 🛣️ Rutas API (`server/routes/`)
Controladores HTTP REST.
- **`admin.ts`**: Panel Admin (`GET /users`, `GET /backup/zip`).
- **`ai.ts`**: Chat (`POST /chat`), Gestión Proveedores (`GET/POST /providers`).
- **`calendar.ts`**: Calendario (`GET /events`).
- **`dashboard.ts`**: Resumen (`GET /summary`).
- **`discovery.ts`**: Discovery (`GET /candidates`).
- **`market.ts`**: Mercado (`GET /quote/:ticker`, `GET /search`).
- **`alerts.ts`**: Alertas Unificadas y Globales de Portfolio.

### ⏱️ Cron Jobs (`server/jobs/`)
Tareas programadas.
- **`discoveryJob.ts`**: (**Ciclos Dinámicos**) **Crawler Inteligente**. Dual Pipeline (US/Global).
- **`catalogEnrichmentJob.ts`**: Enriquecimiento de segundo plano.
- **`backupJob.ts`**: Copias automáticas.

### 🧪 Tests (`server/tests/`)
Pruebas de integración (`bun test`).
- **`auth.test.ts`**, **`market.test.ts`**, **`pnl.service.test.ts`**, **`alerts.test.ts`**.

---

## 🎨 4. Frontend (`src/`)
SPA construida con **React 19**, **Vite** y **TailwindCSS**.

### 🧩 Contexto (`src/context/`)
- **`AuthContext.tsx`**: Sesión global.
- **`ToastContext.tsx`**: Notificaciones no intrusivas.

### 📱 Pantallas (`src/screens/`)
- **`Dashboard.tsx`**: Layout "Premium" 2 columnas. AI Insight, Top Movers, PnL Chart.
- **`PortfolioScreen.tsx`**: Gestión de inversiones.
- **`MarketAnalysis.tsx`**: Screener técnico.
- **`AdminScreen.tsx`**: Panel de Control con pestañas (General, IA, Mercado, Backup).

### 🧩 Componentes Clave
- **`Sidebar.tsx`**: Navegación Glassmorphism.
- **`Header.tsx`**: Cabecera con Breadcrumbs.
- **`PositionAnalysisModal.tsx`**: Modal "Green Leader" de análisis profundo (6 pestañas).

---

## 5. Documentación
- **`memoria.md`**: Referencia técnica Global (V2.1.0).
- **`RELEASE_NOTES.md`**: Historial de versiones y cambios recientes.
- **`PROJECT_INDEX.md`**: Índice técnico maestro.

---

## 🐳 6. Ejecución (Docker)
**IMPORTANTE**: El entorno es Windows sin Bun local. Todo debe correrse en Docker.

```powershell
docker compose up -d --build
docker compose exec app bun test
```
