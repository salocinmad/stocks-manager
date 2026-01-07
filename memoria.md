# 🧠 Memoria del Proyecto: Stocks Manager

## 1. Identidad y Propósito
**Stocks Manager** es una aplicación web avanzada para la gestión de carteras de inversión personales, diseñada para ofrecer herramientas profesionales (Análisis Técnico, Métricas de Riesgo, IA) en una interfaz moderna y accesible.

*   **Versión Actual**: v2.1.0 (Hotfix 7 Enero 2026)
*   **Estado**: Producción / Estable.

## 2. Pila Tecnológica
### Backend
*   **Runtime**: Bun v1.2 (Speed focused)
*   **Framework**: ElysiaJS (High performance API)
*   **Base de Datos**: PostgreSQL 16 (con `postgres.js` client)
*   **IA**: Integración multi-provider (Google Gemini, OpenAI, Ollama Local).

### Frontend
*   **Framework**: React 18 + Vite
*   **Lenguaje**: TypeScript
*   **Estilos**: TailwindCSS v3.4 + CSS Modules
*   **Gráficos**: Recharts + Lightweight Charts (TradingView)

### Infraestructura
*   **Contenerización**: Docker & Docker Compose
*   **Proxy inverso recomendados**: Nginx / Cloudflare (Nota: Requiere gestión de caché estricta para actualizaciones).

## 3. Arquitectura Modular

### 3.1. Gestión de Portafolios (`/portfolios`, `/positions`)
*   **Multi-Cartera**: Soporte ilimitado de portafolios.
*   **Transacciones**: Historial inmutable (BUY/SELL/DIVIDEND). Soporte de comisiones y tipos de cambio históricos.
*   **PnL Engine**: Cálculo en tiempo real de Ganancia/Pérdida, CAGR, y desglose FIFO. Cacheo diario en `pnl_history_cache`.
*   **Validación**: Control estricto de inputs decimales (comas/puntos) y tipos de cambio.

### 3.2. Datos de Mercado (`/market`)
*   **Proveedores**:
    *   **Yahoo Finance**: Datos en tiempo real, histórico de velas y búsquedas globales.
    *   **Finnhub**: Noticias de mercado y sentiment (US).
    *   **EODHD**: Catálogo maestro de bolsas (Exchanges).
*   **Crawler / Discovery Engine**: Jobs en segundo plano (`discoveryJob`) que escanean mercados globales (Split-World Strategy: US vs Global) para encontrar oportunidades ("Compounders", "Cheap Growth").
*   **Catálogo Maestro**: Sistema configurable para activar/desactivar bolsas por región (`global_tickers`).

### 3.3. IA y Análisis (`/ai`)
*   **ChatBot Financiero**: Asistente contextual que conoce el portafolio del usuario.
*   **Análisis de Posición**: Generación de informes on-demand sobre activos específicos (Riesgo, Tendencia, Fundamental).
*   **Prompting**: Sistema de plantillas de sistema gestionables desde DB.

### 3.4. Sistema de Alertas (`/alerts`)
*   **Alertas de Precio**: Trigger por cruce de umbral.
*   **Alertas Globales**: Monitorización del cambio diario total del portafolio (ej: "Avisar si cae > 2%").
*   **Motor**: CronJob minutal (`portfolioAlertService`) con cooldown inteligente.

### 3.5. Administración (`/admin`)
*   **Backups**: Sistema de copias de seguridad completas (DB + Uploads + Settings) con descarga zip.
*   **Logs**: Monitor de actividad.
*   **Configuración**: Gestión de bolsas activas y providers de IA.

## 4. Base de Datos (Schema)
El esquema se define en `init.sql`. Puntos clave:
*   `users`: Autenticación y preferencias.
*   `transactions`: Tabla central inmutable. Campos críticos: `amount`, `price_per_unit`, `fees` (comisión), `exchange_rate_to_eur`.
*   `market_discovery_cache` & `market_cache`: Almacenamiento JSONB de datos volátiles.
*   `system_settings`: Configuración clave-valor (ej: `GLOBAL_TICKER_EXCHANGES`).
*   `global_tickers`: Catálogo maestro de bolsas mundiales sincronizado desde EODHD.
*   `portfolio_alerts`: Sistema de alertas globales a nivel de portafolio (PnL diario, exposición sectorial).

## 5. Historial de Cambios Recientes (v2.1.0)
*   **UI Revamp**: Dashboard de 2 columnas, Sidebar con versión y estado.
*   **Fixes Críticos**:
    *   Sanitización de decimales en frontend (reemplazo `,` -> `.`).
    *   Alineación de parámetros Backend (`commission` mapped to `fees`).
    *   Manejo robusto de `exchange_rate` en ventas.

## 6. Notas de Despliegue
*   **Cache Busting**: Debido a la naturaleza SPA (Single Page Application), es crítico limpiar cachés de CDN (Cloudflare) o Proxies (Nginx) tras cada despliegue.
*   **Comandos**:
    *   Build: `docker compose up -d --build`
    *   Clean Nginx: `rm -rf /var/cache/nginx/*`
    *   Verify Version: `docker exec stocks_app grep '"version":' package.json`
