# 🗂️ Stocks Manager - Project Index
> **Versión**: v2.1.0
> **Fecha de Actualización**: 8 Enero 2026

Este archivo actúa como índice maestro de la estructura del proyecto y su funcionalidad.

## 1. Estructura de Directorios

### `/server` (Backend - Bun/Elysia)

#### Core
| Archivo | Descripción |
|---------|-------------|
| `index.ts` | Punto de entrada, configuración Elysia, CronJobs |
| `db.ts` | Conexión PostgreSQL (postgres.js) |

#### Routes (`/routes`)
| Archivo | Descripción |
|---------|-------------|
| `auth.ts` | Login, Registro, 2FA, Reset Password |
| `portfolios.ts` | CRUD Portafolios, Posiciones, Transacciones |
| `market.ts` | Proxy a Yahoo Finance, EODHD, Búsquedas |
| `ai.ts` | ChatBot y Análisis de posición |
| `alerts.ts` | Alertas de precio, técnicas y globales |
| `admin.ts` | Backups, Configuración, Logs, Catálogo Maestro |
| `news.ts` | RSS Feeds y noticias |
| `settings.ts` | Configuración de usuario |

#### Services (`/services`)
| Archivo | Descripción |
|---------|-------------|
| `portfolioService.ts` | Lógica transaccional (PnL, FIFO) |
| `marketData.ts` | Cliente Yahoo Finance / Finnhub |
| `eodhdService.ts` | Cliente EODHD (Catálogo Maestro) |
| `discoveryService.ts` | Lógica del Crawler y Screener |
| `aiService.ts` | Orquestador de LLMs (multi-provider) |
| `backupService.ts` | Generación de ZIPs y restauración |
| `alertService.ts` | Motor de alertas |
| `portfolioAlertService.ts` | Alertas globales de portafolio |
| `positionAnalysisService.ts` | Análisis técnico/fundamental |
| `settingsService.ts` | Configuración del sistema |

#### Jobs (`/jobs`)
| Archivo | Descripción |
|---------|-------------|
| `pnlJob.ts` | Cálculo diario de historial PnL |
| `discoveryJob.ts` | Crawler Split-World (USA/Global) |
| `catalogEnrichmentJob.ts` | Enriquecimiento de global_tickers |
| `backupJob.ts` | Programador de backups |
| `positionAnalysisJob.ts` | Análisis técnico en lote |

#### Utils (`/utils`)
| Archivo | Descripción |
|---------|-------------|
| `exchangeMapping.ts` | Mapeo EODHD Code → Yahoo Suffix |
| `logger.ts` | Sistema de logging centralizado (niveles, rotación) |

---

### `/src` (Frontend - React/Vite)

#### Screens (`/screens`)
| Archivo | Descripción |
|---------|-------------|
| `Dashboard.tsx` | Vista principal (2 columnas) |
| `PortfolioScreen.tsx` | Tabla de posiciones, gráficos |
| `MarketAnalysis.tsx` | Noticias, Calendario, Discovery |
| `AlertsScreen.tsx` | Gestión de alertas |
| `AdminScreen.tsx` | Panel de control |
| `LoginScreen.tsx` | Autenticación |
| `ProfileScreen.tsx` | Perfil de usuario |

#### Components (`/components`)
| Archivo | Descripción |
|---------|-------------|
| `Sidebar.tsx` | Navegación principal |
| `Header.tsx` | Cabecera con índices |
| `ChatBot.tsx` | Asistente IA flotante |
| `BuyAssetModal.tsx` | Modal de compra/venta |
| `PositionAnalysisModal.tsx` | Análisis de posición (6 tabs) |
| `GlobalSearchModal.tsx` | Búsqueda global (Ctrl+K) |

#### Admin Components (`/components/admin`)
| Archivo | Descripción |
|---------|-------------|
| `MasterCatalogConfig.tsx` | Configuración bolsas mundiales |
| `DataExplorerTable.tsx` | Explorador de datos |
| `AIGeneral.tsx` | Configuración IA |
| `AIProviders.tsx` | Gestión providers IA |
| `AdminSMTP.tsx` | Configuración SMTP |
| `LogsManager.tsx` | Gestión de logs del sistema (descarga/limpieza) |

#### Context (`/context`)
| Archivo | Descripción |
|---------|-------------|
| `AuthContext.tsx` | Autenticación y API client |
| `ToastContext.tsx` | Notificaciones toast |

---

## 2. Documentación Clave

| Archivo | Descripción |
|---------|-------------|
| `memoria.md` | Visión global, arquitectura y estado del proyecto |
| `PROJECT_INDEX.md` | Este archivo - índice maestro |
| `RELEASE_NOTES.md` | Historial de versiones (Changelog) |
| `GUIA_ADMINISTRADOR.md` | Manual de operaciones |
| `MANUAL_USUARIO.md` | Guía de uso de la aplicación |
| `init.sql` | Definición del esquema de Base de Datos |
| `README.md` | Introducción y quick start |

---

## 3. Base de Datos

### Schema (`init.sql`)
22 tablas principales:
- `users`, `portfolios`, `positions`, `transactions`
- `alerts`, `portfolio_alerts`
- `global_tickers` (catálogo maestro)
- `market_cache`, `market_discovery_cache`, `ticker_details_cache`
- `financial_events` (calendario con `updated_at`, `eps`)
- `position_analysis_cache`, `pnl_history_cache`
- `system_settings`, `ai_providers`, `ai_prompts`
- `chat_conversations`, `chat_messages`

### Gestión de Versión
La versión de la aplicación se almacena en `system_settings`:
```sql
SELECT value FROM system_settings WHERE key = 'APP_VERSION';
-- Resultado: 'V2.1.0'
```

---

## 4. Comandos de Operación

### Desarrollo
```bash
bun run dev          # Inicia servidor desarrollo
bun run build:frontend  # Build React
```

### Build & Deploy
```bash
git pull
docker compose up -d --build
```

### Verificación Post-Deploy
```bash
# Verificar versión
docker exec stocks_app grep '"version":' package.json

# Limpiar caché Nginx
rm -rf /var/cache/nginx/*
```

### Tests
```bash
bun run test
```

---

## 5. Bolsas Soportadas (Catálogo Maestro)

### USA
- `NYSE` - New York Stock Exchange
- `NASDAQ` - NASDAQ Stock Exchange
- `AMEX` - NYSE American

### Europa
- `LSE` - London Stock Exchange
- `XETRA` - Frankfurt Xetra
- `PA` - Euronext Paris
- `MC` - Madrid Exchange
- `MI` - Borsa Italiana
- `AS` - Euronext Amsterdam
- `SW` - SIX Swiss Exchange
- `ST` - Stockholm Exchange

### Asia/Pacífico
- `HK` - Hong Kong
- `TSE` - Tokyo Stock Exchange
- `AU` - Australian Securities Exchange
- `NSE` - India NSE
- `SG` - Singapore

### Américas
- `TO` - Toronto Stock Exchange
- `SA` - B3 Brasil
