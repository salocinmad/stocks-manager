# Stocks Manager

Gestor de carteras diseñado para seguimiento de posiciones, cálculo de PnL en EUR, contribución por empresa y snapshots diarios, con un panel de administración para automatizaciones y tareas de mantenimiento.

## Arquitectura
- Frontend: React + Vite (gráficas con Recharts).
- Backend: Node.js + Express.
- Persistencia: Sequelize (MariaDB).
- Integraciones externas:
  - Yahoo Finance: cotizaciones y tipos de cambio (EURUSD=X, EURGBP=X).
  - Finnhub (opcional): cotizaciones en tiempo real si se configura API Key. Dispone de plan gratuito con límite de 60 peticiones por minuto.

## Funcionalidades
- Posiciones activas con cálculo de “Ganancia/Pérdida” en EUR (usa tipo de cambio actual para USD; otras divisas usan el exchangeRate de compra ponderado).
- Gráfica “Contribución por Empresa” con colores diferenciados y leyenda sincronizada.
- Gráfica de PnL de los últimos 30 días (serie diaria basada en snapshots).
- Actualización de precios y FX bajo demanda (botón “🔄 Actualizar Precios”).
- Cierre diario: genera snapshots (DailyPrices) del día laboral anterior en horario de España.
- Panel de administración: configuración del scheduler, ejecución manual del cierre y acciones de mantenimiento.

## API (resumen)
- Base: `VITE_API_URL` (por defecto `/api`).
- Autenticación:
  - `POST /api/auth/login` (token/session usada por `authenticatedFetch`).
- Operaciones:
  - `GET /api/operations` | `POST /api/operations` | `PUT /api/operations/:id` | `DELETE /api/operations/:id` | `DELETE /api/operations`.
- Notas:
  - `GET /api/notes/:positionKey` | `PUT /api/notes/:positionKey` | `DELETE /api/notes/:positionKey`.
- Precios (caché):
  - `POST /api/prices/bulk` (por positionKeys) | `PUT /api/prices/:positionKey`.
- Portfolio:
  - `GET /api/portfolio/contribution?date=YYYY-MM-DD`.
  - `GET /api/portfolio/timeseries?days=30`.
- Admin:
  - `GET/POST /api/admin/scheduler` | `POST /api/admin/scheduler/run`.
  - `POST /api/admin/daily-close/run`.
  - `POST /api/admin/resetadmin` | `GET /api/admin/resetadmin/status` | `POST /api/admin/resetadmin/rollback`.
- Config:
  - `GET /api/config` | `GET /api/config/:key` | `POST /api/config/:key` | `DELETE /api/config/:key`.
- Salud:
  - `GET /api/health`.

## Yahoo Finance y normalización
- Cotizaciones: `regularMarketPreviousClose` y `regularMarketPrice`.
- Símbolos: se normalizan mapeando separadores `:` y `-` a `.` donde corresponde.
- Tipos de cambio a EUR:
  - `EURUSD=X`: se usa “EUR por 1 USD” y se multiplica el valor en USD por ese factor.
  - `EURGBP=X`: mapeo similar para GBP.

## Cierre diario (Spain timezone)
- Fecha objetivo: “día laboral anterior” calculado en zona `Europe/Madrid`.
- Por cada posición (empresa+símbolo), se guarda `close`, `currency`, `exchangeRate` y `source=yahoo`.
- Índice único: `(userId, positionKey, date)`.

## Scheduler de precios
- Configurable en `/admin` (enabled/interval en minutos) y persistente en base de datos.
- Ejecuta actualizaciones periódicas de caché de precios.

## Variables de entorno (ejemplo)
- `.env`:
  - `MYSQL_USER=portfolio_manager`
  - `MYSQL_PASSWORD=portfolio_manager`
  - `MYSQL_DATABASE=portfolio_manager`
  - `VITE_API_URL=/api`

## Instalación con Docker
1. Clonar el repositorio:
   - `git clone https://github.com/salocinmad/stocks-manager.git`
   - `cd stocks-manager`
2. Construcción estándar:
   - `docker compose build`
3. Arranque:
   - `docker compose up -d`
4. Reconstrucción sin caché (recomendado tras cambios grandes):
   - `docker compose build --no-cache`
   - `docker compose up -d`
5. Logs:
   - `docker compose logs -f`

> Ver guía ampliada en `DOCKER.md` (backup/restore, troubleshooting, exec dentro de contenedores).

## Instalación en Desarrollo (sin Docker)
1. Clonar el repositorio:
   - `git clone https://github.com/salocinmad/stocks-manager.git`
   - `cd stocks-manager`
2. Backend:
   - `cd server && npm install && npm start`
3. Frontend:
   - `cd frontend && npm install && npm run dev`

## Panel de Administración
- Botón `🛠️ Admin` visible solo para usuarios admin.
- Configuración de scheduler, ejecución de cierre diario y utilidades.

## Reset de Administrador
- Documento dedicado: `ADMIN_RESET.md`.
- Método principal: `POST /api/admin/resetadmin`.

## Troubleshooting
- Frontend en negro: revisar consola (p. ej. `React is not defined` → importar hooks correctamente) y reconstruir frontend.
- Cierre diario: verificar `daily_close_last_run` y filas en `DailyPrices` para la fecha esperada.
