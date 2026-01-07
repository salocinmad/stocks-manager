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

### 💰 Gestión de Portafolios
*   Soporte Multi-Cartera y Multi-Divisa (Conversión automática a EUR).
*   **Métricas**: PnL Diario, Total, CAGR, Distribución Sectorial.
*   **Gráficos**: Historia de valor (PnL History) precalcutada diariamente.

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
*   `market_cache` / `ticker_details_cache`: Almacenamientode datos volátiles (Precios, Fundamentales) para no saturar APIs externas.
*   `ai_prompts` / `ai_providers`: Configuración de la IA.

---

## 5. Historial de Decisiones Recientes (v2.1)
1.  **Mantener Frecuencia Alta**: Se decidió NO bajar la frecuencia del Crawler (3 min) para tener datos frescos. A cambio, se reescribió el motor (`discoveryJob.ts`) para ser mucho más eficiente (Batch Processing).
2.  **Seguridad Primero**: Se implementaron transacciones SQL reales para evitar desbalanceos si falla una operación a mitad de camino.
3.  **Frontend Veloz**: Se migró a componentes `lazy` para mejorar el Time-To-Interactive.

---

## 6. Comandos Útiles
*   **Ver Logs**: `docker compose logs -f stocks_app`
*   **Backup Manual**: Endpoint POST `/api/admin/backups/create`
*   **Rebuild**: `docker compose up -d --build` (Necesario tras cambios en Backend o dependencias).
