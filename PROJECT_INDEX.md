# 🗂️ Stocks Manager - Project Index
> **Versión**: v2.1.0
> **Fecha de Actualización**: 7 Enero 2026

Este archivo actúa como índice maestro de la estructura del proyecto y su funcionalidad.

## 1. Estructura de Directorios

### `/server` (Backend - Bun/Elysia)
*   **Core**:
    *   `index.ts`: Punto de entrada, configuración del servidor Elysia.
    *   `db/index.ts`: Conexión PostgreSQL (postgres.js).
*   **Routes (`/routes`)**:
    *   `auth.ts`: Login, Registro, 2FA, Reset Password.
    *   `portfolios.ts`: CRUD Portafolios, Posiciones, Transacciones.
    *   `market.ts`: Proxy a Yahoo Finance, EODHD, Búsquedas.
    *   `ai.ts`: Chatbot y Análisis.
    *   `alerts.ts`: Gestión de alertas de precio y globales.
    *   `admin.ts`: Backups, Configuración del sistema, Logs.
    *   `news.ts`: RSS Feeds y noticias.
*   **Services (`/services`)**:
    *   `portfolioService.ts`: Lógica de negocio transaccional (PnL, FIFO).
    *   `marketData.ts`: Cliente de APIs externas (Yahoo, Finnhub).
    *   `discoveryService.ts`: Lógica del Crawler y Screener.
    *   `aiService.ts`: Orquestador de LLMs.
    *   `backupService.ts`: Generación de ZIPs y restauración.
*   **Jobs (`/cron`)**:
    *   `pnlJob.ts`: Cálculo diario de historial de rendimiento.
    *   `discoveryJob.ts`: Crawler de mercado (Split-World).
    *   `backupJob.ts`: Programador de copias de seguridad.
*   **Scripts (`/scripts`)**:
    *   `init_db.ts`: (Si existe) Inicialización de datos.

### `/src` (Frontend - React/Vite)
*   **Screens (`/screens`)**:
    *   `DashboardScreen.tsx`: Vista principal (2 columnas).
    *   `PortfolioScreen.tsx`: Tabla de posiciones, gráficos, modales de compra/venta.
    *   `MarketAnalysis.tsx`: Noticias, Calendario, Discovery.
    *   `AlertsScreen.tsx`: Gestión de alertas.
    *   `AdminScreen.tsx`: Panel de control.
*   **Components (`/components`)**:
    *   `Sidebar.tsx`: Navegación principal.
    *   `BuyAssetModal.tsx`: Formulario de transacciones.
    *   `PnLChart.tsx`: Gráficos financieros.
    *   `ChatBot.tsx`: Asistente flotante.

## 2. Documentación Clave
*   `memoria.md`: Visión global, arquitectura y estado del proyecto.
*   `RELEASE_NOTES.md`: Historial de versiones y cambios (Changelog).
*   `GUIA_ADMINISTRADOR.md`: Manual de operaciones (Backups, Configuración).
*   `MANUAL_USUARIO.md`: Guía de uso de la aplicación.
*   `API_CATALOG.md`: Documentación de endpoints REST.
*   `init.sql`: Definición del esquema de Base de Datos.

## 3. Comandos de Operación
*   **Desarrollo**: `bun run dev`
*   **Build & Deploy**:
    ```bash
    git pull
    docker compose up -d --build
    ```
*   **Tests**: `bun test`
*   **Limpieza de Caché (Deploy)**:
    ```bash
    docker exec stocks_app grep '"version":' package.json # Verificar versión
    rm -rf /var/cache/nginx/* # Limpiar Nginx
    ```
