# 📋 PROJECT_INDEX.md - Stocks Manager

> **Versión: 2.1.3** | Índice técnico del proyecto

---

## 📂 Estructura de Directorios

```
stocks-manager/
├── server/                    # Backend (Bun + ElysiaJS)
├── src/                       # Frontend (React 19)
├── public/                    # Assets estáticos + PWA
├── dist/                      # Build producción (generado)
├── uploads/                   # Avatares y adjuntos
└── *.md                       # Documentación
```

---

## 🗃️ Backend (`server/`)

### Routes (`server/routes/`)
| Archivo | Endpoints |
|---------|-----------|
| `auth.ts` | Login, register, 2FA, reset-password |
| `portfolios.ts` | CRUD portfolios, positions, transactions |
| `market.ts` | Quotes, history, search |
| `alerts.ts` | CRUD alertas individuales |
| `admin.ts` | Usuarios, settings, backup, logs |
| `ai.ts` | Análisis IA de portafolio |
| `chat.ts` | ChatBot conversations/messages |
| `analysis.ts` | Position Analysis (6 tabs) |
| `calendar.ts` | Financial events |
| `notifications.ts` | Notification channels |
| `reports.ts` | Tax reports, exports |
| `importers.ts` | CSV/broker imports |
| `watchlist.ts` | Watchlists |
| `notes.ts` | Notes con Markdown |
| `settings.ts` | User settings |
| `user.ts` | Profile, avatar |
| `public.ts` | Health check, version |

### Services (`server/services/`)
| Archivo | Función |
|---------|---------|
| `portfolioService.ts` | FIFO, PnL, recalculations |
| `marketData.ts` | Yahoo V8/V10, caching |
| `aiFactory.ts` | Multi-provider AI factory |
| `positionAnalysisService.ts` | 6-tab analysis |
| `alertService.ts` | Alert checking |
| `portfolioAlertService.ts` | Global portfolio alerts |
| `pnlService.ts` | **[v2.1.2]** Cálculo PnL histórico, posiciones en fecha |
| `discoveryService.ts` | Discovery Engine logic |
| `eodhdService.ts` | EODHD API client |
| `settingsService.ts` | System settings |
| `backupService.ts` | Backup/restore con cifrado |

### Jobs (`server/jobs/`)
| Archivo | Frecuencia |
|---------|------------|
| `discoveryJob.ts` | Cada 3 min |
| `catalogEnrichmentJob.ts` | Cada 3 min |
| `globalTickerJob.ts` | Configurable |
| `calendarJob.ts` | Cada 6h |
| `pnlJob.ts` | 4:00 AM diario |
| `positionAnalysisJob.ts` | 00/06/12/18h |
| `marketEventsSyncJob.ts` | 2 tickers/5min |
| `backupJob.ts` | Cada minuto (check) |

### Utils (`server/utils/`)
| Archivo | Función |
|---------|---------|
| `logger.ts` | Logging con niveles |
| `exchangeMapping.ts` | EODHD → Yahoo mapping |

---

## 🎨 Frontend (`src/`)

### Screens (`src/screens/`)
| Archivo | Vista |
|---------|-------|
| `DashboardScreen.tsx` | Dashboard 2 columnas |
| `PortfolioScreen.tsx` | Detalle cartera |
| `DataExplorerScreen.tsx` | Discovery Engine |
| `AlertsScreen.tsx` | Gestión alertas |
| `CalendarScreen.tsx` | Calendario financiero |
| `ReportsScreen.tsx` | Informes fiscales |
| `AdminScreen.tsx` | Panel admin (tabs) |
| `SettingsScreen.tsx` | Configuración usuario |
| `ProfileScreen.tsx` | Perfil + avatar |
| `NotesScreen.tsx` | Notas Markdown |
| `LoginScreen.tsx` | Login + 2FA |

### Components Clave (`src/components/`)
| Archivo | Función |
|---------|---------|
| `ChatBot.tsx` | ChatBot flotante/fullscreen |
| `Sidebar.tsx` | Navegación desktop |
| `MobileNavigation.tsx` | Bottom nav + drawer móvil |
| `PositionAnalysisModal.tsx` | Modal 6 tabs |
| `DiscoveryAnalysisModal.tsx` | Análisis discovery |
| `TransactionHistoryModal.tsx` | Editor transacciones |
| `GlobalSearchModal.tsx` | Búsqueda global (Cmd+K) |
| `KeyboardShortcutsProvider.tsx` | Atajos de teclado |

### Context (`src/context/`)
| Archivo | Estado Global |
|---------|---------------|
| `AuthContext.tsx` | user, token, api, appVersion |

---

## 🗄️ Base de Datos

### Migración Automática
- Ubicación: `server/init_db.ts`
- Se ejecuta al iniciar la aplicación
- Usa `IF NOT EXISTS` y `ON CONFLICT DO NOTHING`

### Tablas Principales
Ver `memoria.md` para lista completa (22 tablas).

---

## 📱 PWA (`public/`)

| Archivo | Descripción |
|---------|-------------|
| `manifest.json` | Config PWA: nombre, colores, iconos |
| `sw.js` | Service Worker: cache de assets |
| `pwa-192x192.png` | Icono Android |
| `pwa-512x512.png` | Splash screen |
| `favicon.png` | Favicon navegador |

---

## 🐳 Docker

| Archivo | Uso |
|---------|-----|
| `Dockerfile` | Multi-stage build |
| `docker-compose.yml` | Desarrollo (build local) |
| `docker-compose.prod.yml` | Producción (imagen GHCR) |
| `.env.example` | Template de variables |

---

## 📚 Documentación

| Archivo | Contenido |
|---------|-----------|
| `memoria.md` | Visión global para IA |
| `PROJECT_INDEX.md` | Este índice técnico |
| `RELEASE_NOTES.md` | Historial de versiones |
| `README.md` | Instalación y features |
| `GUIA_ADMINISTRADOR.md` | Manual de admin |
| `MANUAL_USUARIO.md` | Manual de usuario |
| `CREDITOS.md` | Librerías y créditos |

---

## 🔧 Scripts

```bash
# Desarrollo
docker compose up -d --build

# Tests
bun run server/scripts/test_runner.ts

# Limpiar usuarios de test
bun run server/scripts/cleanup_test_users.ts
```

---

**Última actualización**: 8 Julio 2026 | v2.1.3 (FIFO Live Lots Tab & UI Improvements)
