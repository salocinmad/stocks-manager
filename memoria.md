# 🧠 Memoria del Proyecto - Stocks Manager

> **Versión**: v2.1.0
> **Fecha de Actualización**: 7 Enero 2026
> **Estado**: Producción (Stable)

## 1. Visión Global
**Stocks Manager** es una plataforma web avanzada de gestión de carteras de inversión y descubrimiento de oportunidades de mercado ("Chicharros" y "Compounders").
A diferencia de un simple tracker, ofrece **Análisis Cuantitativo y Fundamental Automático** (Valuation, Graham Number, Riesgo) y usa **Inteligencia Artificial** (Multi-Proveedor) para generar insights personalizados.

## 2. Arquitectura Técnica
El sistema sigue un modelo **Cliente-Servidor (Monorepo)** desplegado via Docker.

### Frontend (`/src`)
*   **Tecnología**: React 18 (Vite), TypeScript, TailwindCSS.
*   **Enrutado**: HashRouter (para compatibilidad estática).
*   **Optimización**: "Lazy Loading" (Code Splitting) en todas las rutas principales para carga instantánea.
*   **UI/UX**: Diseño moderno "Glassmorphism" y "Dark Mode" nativo.

### Backend (`/server`)
*   **Tecnología**: Bun (Runtime), ElysiaJS (High-Performance Framework).
*   **Base de Datos**: PostgreSQL 16 con extensión `uuid-ossp`.
*   **Seguridad**:
    *   Autorización JWT (con 2FA opcional).
    *   **Transacciones Atómicas**: Usa `sql.begin()` para garantizar integridad en operaciones financieras críticas (Compra/Venta/Rebalanceo).

### Infraestructura
*   **Docker Compose**: Orquesta `stocks_app` (Backend que sirve el Frontend estático) y `stocks_db` (Postgres).
*   **Jobs**:
    *   `DiscoveryJob`: Crawler de mercado (cada 3 min).
    *   `CatalogEnrichmentJob`: Enriquecimiento de catálogo maestro.
    *   `BackupJob`: Copias de seguridad automáticas (Stream-to-Disk).

---

## 3. Funcionalidades Clave (Core)

### 🦁 Discovery Engine (Motor de Descubrimiento)
Es el corazón de la búsqueda de oportunidades.
*   **Estrategia Split-World**:
    *   **Pipeline USA**: Usa Finnhub para datos de EE.UU.
    *   **Pipeline Global**: Usa Yahoo Finance para Europa y Asia.
*   **Optimización (v2.1)**:
    *   **Paralelismo**: Procesa activos en lotes de 5 concurrentes.
    *   **Batch Writes**: Ingesta datos masivos en BBDD reduciendo I/O en un 80%.
    *   **Consistencia**: Mantiene frecuencia de 3 minutos sin saturar el servidor.
    *   **Regiones Dinámicas**: El Discovery Job lee la configuración de bolsas activas desde `system_settings`.

### 🌍 Catálogo Maestro (Master Catalog Management) [NUEVO v2.1]
Permite al administrador configurar qué bolsas mundiales alimentan el catálogo de empresas.
*   **Componente UI**: `MasterCatalogConfig.tsx` en Admin > Mercado > Catálogo Maestro.
*   **Funcionalidades**:
    *   Lista de 74+ bolsas mundiales obtenidas de **EODHD API**.
    *   Búsqueda y filtrado por país/código.
    *   Toggle para ver solo bolsas seleccionadas.
    *   Detección y limpieza de códigos "huérfanos" (guardados pero no válidos en EODHD).
    *   **Limpieza Profunda**: Al desmarcar una bolsa, se eliminan automáticamente:
        *   Registros de `global_tickers` por código de exchange.
        *   Registros de `ticker_details_cache` por sufijo Yahoo.
        *   Registros de `market_discovery_cache` (categoría `catalog_global`).
*   **Caché**: Lista de bolsas EODHD se cachea 30 días en `market_cache`.
*   **Mapeo de Códigos**: `server/utils/exchangeMapping.ts` contiene el mapeo EODHD → Yahoo (ej: `LSE` → `.L`, `XETRA` → `.DE`).

### 💰 Gestión de Portafolios
*   Soporte Multi-Cartera y Multi-Divisa (Conversión automática a EUR, soporte GBX → GBP).
*   **Métricas**: PnL Diario, Total, CAGR, Distribución Sectorial.
*   **Fair Value (Graham Number)**: Cálculo automático en Discovery con indicador visual.
*   **Gráficos**: Historia de valor (PnL History) precalculada diariamente.

### 🤖 Inteligencia Artificial (Multi-Provider)
Analista financiero personal integrado en el chat.
*   **Proveedores Soportados**: Google Gemini, OpenAI, Claude (via OpenRouter), Groq, Ollama (Local).
*   **Prompting**: Perfiles personalizables (Lobo de Wall Street, Profesor, Analista de Riesgos).
*   **Contexto**: El bot recibe automáticamente el estado del portafolio y precios de mercado antes de responder.

### 🔔 Alertas Globales
Sistema de vigilancia de mercado.
*   **Alertas de Precio**: "Avísame si AAPL baja de 150".
*   **Alertas de Portafolio**: "Avísame si MI CARTERA cae un 2% hoy".

---

## 4. Base de Datos (Schema Resumen)
Ver `server/init_db.ts` para definición exacta.

*   `users`: Credenciales, preferencias, tokens 2FA.
*   `portfolios` -> `positions` -> `transactions`: Jerarquía principal de inversión.
*   `watchlists`: Seguimiento de activos.
*   `alerts`: Reglas de vigilancia.
*   `market_cache`: Datos volátiles (precios, lista de bolsas EODHD con TTL 30 días).
*   `ticker_details_cache`: Información fundamental de activos.
*   `global_tickers`: Catálogo maestro de símbolos (poblado por EODHD sync).
*   `market_discovery_cache`: Resultados del Discovery Engine (JSON Array).
*   `system_settings`: Configuración global (API keys, bolsas activas `GLOBAL_TICKER_EXCHANGES`, etc.).
*   `ai_prompts` / `ai_providers`: Configuración de la IA.

---

## 5. Archivos Clave Nuevos (v2.1)
*   `server/utils/exchangeMapping.ts`: Mapeo EODHD Code → Yahoo Suffix (50+ bolsas).
*   `src/components/admin/MasterCatalogConfig.tsx`: UI de configuración del catálogo maestro.
*   `server/routes/admin.ts`: Endpoints `/admin/market/exchanges` (GET/POST).

---

## 6. Historial de Decisiones Recientes (v2.1)
1.  **Catálogo Maestro Configurable**: Se creó UI para que el admin seleccione bolsas sin editar código.
2.  **Limpieza Profunda Automática**: Al desmarcar una bolsa, se eliminan TODOS los datos asociados (tickers, cache, discovery).
3.  **Regiones Dinámicas**: El Discovery Job ahora lee `GLOBAL_TICKER_EXCHANGES` de `system_settings` en lugar de usar valores hardcodeados.
4.  **Detección de Códigos Huérfanos**: UI muestra warning cuando hay códigos guardados que ya no existen en EODHD.
5.  **Seguridad Primero**: Se implementaron transacciones SQL reales para evitar desbalanceos.
6.  **Frontend Veloz**: Componentes `lazy` para mejorar Time-To-Interactive.

---

## 7. Comandos Útiles
*   **Ver Logs**: `docker compose logs -f stocks_app`
*   **Backup Manual**: Endpoint POST `/api/admin/backups/create`
*   **Rebuild**: `docker compose up -d --build` (Necesario tras cambios en Backend o dependencias).
*   **Tests**: `cd server && bun test` (usa `server/tests/run_tests.ts` con reporte visual).
