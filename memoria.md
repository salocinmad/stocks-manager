# 🧠 Memoria Técnica - Stocks Manager v2.1.0

> **Estado del Proyecto**: V2.1.0 (Producción)
> **Última Actualización**: 7 Enero 2026
> **Tecnologías**: Bun, ElysiaJS, React 19, PostgreSQL, TailwindCSS 3.4.

Este documento sirve como referencia global del estado técnico y funcional del proyecto "Stocks Manager".

---

## 1. Arquitectura del Sistema

El sistema es una aplicación monolítica modularizada corriendo sobre **Bun** (Runtime).

### 1.1 Backend (`/server`)
- **Runtime**: Bun 1.2
- **Framework**: ElysiaJS (High-performance framework)
- **Base de Datos**: PostgreSQL 16 (ver `init.sql` para esquema de 23 tablas).
- **ORM**: `postgres.js` (Librería SQL nativa, sin ORM pesado por rendimiento).
- **Autenticación**: JWT + Cookies. Soporta 2FA (TOTP) y Códigos de Backup.

### 1.2 Frontend (`/src`)
- **Framework**: React 19 (Vite).
- **Estilos**: TailwindCSS 3.4 + `lucide-react` para iconos.
- **Gráficos**: `lightweight-charts` (TradingView) para velas, `recharts` para tartas/líneas simples.
- **Diseño**: Interfaz "Dark Premium" inspirada en brokers profesionales.

---

## 2. Base de Datos (Esquema v2.1)

El sistema cuenta con **23 tablas** principales en el esquema `public`.

### Núcleo de Usuario
- `users`: Gestión de cuentas, preferencias (divisa), seguridad (2FA).
- `portfolios`: Carteras de inversión (múltiples por usuario). Favorito por defecto.
- `positions`: Activos comprados (Stocks, ETFs, Crypto). Soporta Stop/Limit y Notas Markdown.
- `transactions`: Historial de operaciones (Compra, Venta, Dividendo).

### Inteligencia de Mercado
- `historical_data`: Precios diarios OHLCV.
- `global_tickers`: Catálogo Maestro (~70k tickers). Sincronizado con EODHD/Yahoo.
- `market_discovery_cache`: Cache del Discovery Engine (por categoría).
- `ticker_details_cache`: Datos profundos (perfil, métricas) para modales.
- `market_cache`: Cache general de precios en tiempo real (TTL corto).

### Sistema AI
- `ai_providers`: Configuración dinámica de LLMs (Gemini, OpenAI, Ollama Local).
- `ai_prompts`: Plantillas de sistema (Lobo de Wall Street, Profesor, Risk Manager).
- `chat_conversations` / `chat_messages`: Historial de chat persistente.

### Herramientas
- `alerts`: Alertas de precio y técnicas (RSI, SMA).
- `portfolio_alerts`: Alertas globales sobre el valor total de la cartera.
- `watchlists`: Listas de seguimiento.
- `financial_events`: Calendario de dividendos/earnings.
- `system_settings`: Configuración global KV (versión, flags del crawler).

---

## 3. Subsistemas Críticos

### 3.1 Discovery Engine V4.0 (El "Crawler")
Sistema autónomo que busca y enriquece oportunidades de inversión.
- **Dual Pipeline**:
  - **US Pipeline**: Usa Finnhub para mercado americano.
  - **Global Pipeline**: Usa Yahoo Finance V10 para Europa/Asia (GB, DE, ES, HK...). Prioriza `day_gainers` si el mercado está abierto.
- **Efficiency Layer**: Filtro de "Freshness" (7 días). No re-inverstiga tickers actualizados recientemente.
- **Circuit Breaker**: Detecta tickers fallidos permanentemente (`yahoo_status='failed'`) y los excluye para evitar bucles infinitos y OOM.
- **Control Maestro**: Switch global en Admin para apagar/encender todo el motor.

### 3.2 Backup System (Stream-to-Disk)
Sistema robusto para copias de seguridad completas.
- **Ruta**: `/api/backup/zip`
- **Estrategia**: "Stream-to-Disk". Genera el ZIP directamente en un archivo temporal en disco (`temp/`) para no saturar la RAM, incluso con bases de datos grandes.
- **Compresión**: Nivel 1 (Fastest) para evitar saturación de CPU (102% -> 5%).
- **Contenido**: JSON completo de la DB + Carpeta `uploads/` (imágenes de noticias/avatares).

### 3.3 Gestión de Precios y GBX
- **Normalización**: Soporte nativo para Peniques Británicos (GBX). El sistema detecta GBX y divide por 100 para mostrar GBP en totales, manteniendo GBX en precios unitarios.
- **Mercado UX**: Mapeo inteligente de estados de Yahoo (`POSTPOST`/`PREPRE` -> `CLOSED`) para que el usuario vea claramente cuando el mercado está cerrado.

---

## 4. Notas de Implementación (Dev)

### Jobs (`server/jobs`)
Se ejecutan vía `cron` interno o triggers manuales:
- `backupJob.ts`: Copias automáticas (Semanal/Mensual).
- `catalogEnrichmentJob.ts`: Procesa la cola de `global_tickers`.
- `discoveryJob.ts`: Busca nuevos candidatos en screeners externos.
- `alertJob.ts`: Verifica condiciones de alertas cada X minutos.
- `pnlHistoryJob.ts`: Calcula y guarda la foto fija del patrimonio diario.

### Comandos Útiles
- **Docker**: `docker compose up -d --build` (Rebuild completo).
- **Tests**: `bun test` (Ejecuta suite completa con runner personalizado colorizado).
- **Limpieza**: El sistema limpia temporales al reinicio, pero s recomienda purgar `temp/` si el disco se llena.

---

## 5. Roadmap & Pendientes
- [x] Optimización de Backup (Done v2.1.0)
- [x] Corrección Estados Mercado (Done v2.1.0)
- [ ] Implementación de WebSockets para precios en tiempo real (Futuro).
- [ ] Soporte para Opciones/Derivados (Futuro).

**Este documento debe ser consultado por cualquier agente antes de iniciar modificaciones estructurales.**
