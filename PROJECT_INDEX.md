# 🗂️ Stocks Manager - Project Index

> **Versión**: v2.1.0 (Stable)  
> **Estado**: Optimizado (Lazy Loading, Atomic Tx, Crawler Batching, Master Catalog)  
> **Fecha**: 7 Enero 2026

Este documento sirve como índice maestro para navegar por el código fuente y la documentación del proyecto **Stocks Manager**.

## 📚 Documentación Clave

*   **[memoria.md](./memoria.md)**: Visión global del proyecto, arquitectura y estado actual. (Lectura obligatoria para IA).
*   **[RELEASE_NOTES.md](./RELEASE_NOTES.md)**: Historial de cambios y novedades de la versión v2.1.0.
*   **[GUIA_ADMINISTRADOR.md](./GUIA_ADMINISTRADOR.md)**: Manual para gestión del servidor, backups y crawler.
*   **[MANUAL_USUARIO.md](./MANUAL_USUARIO.md)**: Guía funcional para el usuario final.

---

## 🏗️ Arquitectura y Stack

El proyecto es una aplicación web Full-Stack moderna (Cliente-Servidor).

*   **Frontend**: React 18, Vite, TypeScript, TailwindCSS.
    *   Arquitectura "Lazy Loading" para carga rápida.
    *   Componentes en `src/screens` y `src/components`.
*   **Backend**: Node.js (Bun runtime), ElysiaJS (Framework tipo Express pero más rápido).
    *   API REST en `server/routes`.
    *   Jobs en segundo plano en `server/jobs` (Crawler, PnL).
    *   Transacciones Atómicas con `postgres.js`.
*   **Base de Datos**: PostgreSQL 16.
    *   Esquema definido en `server/init_db.ts`.
*   **Infraestructura**: Docker & Docker Compose.

---

## 📂 Estructura de Directorios

### Raíz
*   `docker-compose.yml`: Orquestación de contenedores (App + DB).
*   `Dockerfile`: Construcción de la imagen de producción.
*   `.env`: Variables de entorno (Secretos, Configuración).

### Frontend (`/src`)
*   `/screens`: Páginas principales (Dashboard, Portfolio, Market, Admin).
*   `/components`: Bloques reutilizables (Tablas, Gráficas, Modales).
    *   `/components/admin`: Componentes de administración.
        *   `MasterCatalogConfig.tsx`: **[NUEVO]** Configuración del catálogo maestro de bolsas.
        *   `MarketIndicesSelector.tsx`: Selector de índices de cabecera.
*   `/services/api.ts`: Cliente HTTP (Axios) para comunicarse con el Backend.

### Backend (`/server`)
*   `index.ts`: Punto de entrada. Configura servidor y Cron Jobs.
*   `db.ts`: Conexión a Base de Datos.
*   `/routes`: Endpoints de la API.
    *   `admin.ts`: Endpoints de administración incluyendo `/market/exchanges`.
*   `/services`: Lógica de negocio (Discovery, Portfolio, MarketData).
    *   `eodhdService.ts`: Servicio EODHD con `getAvailableExchanges()`.
*   `/jobs`: Tareas en segundo plano.
    *   `discoveryJob.ts`: Crawler optimizado (Lotes + Paralelo + Regiones Dinámicas).
    *   `catalogEnrichmentJob.ts`: Enriquecimiento del catálogo maestro.
    *   `backupJob.ts`: Sistema de copias de seguridad.
*   `/utils`: Utilidades compartidas.
    *   `exchangeMapping.ts`: **[NUEVO]** Mapeo EODHD Code → Yahoo Suffix.
*   `/tests`: Tests automatizados (Bun Test).

---

## 🚀 Comandos Principales

### Desarrollo (Local)
```bash
# Iniciar todo (Backend + Frontend + DB)
docker compose up -d

# Ver logs en tiempo real
docker compose logs -f stocks_app

# Reconstruir tras cambios en Backend
docker compose up -d --build
```

### Tests
```bash
# Ejecutar tests con reporte visual
cd server && bun test
```

### Gestión
```bash
# Copia de seguridad manual
curl -X POST http://localhost:3000/api/admin/backups/create

# Resetear BBDD (Peligroso)
docker compose down -v
```

---

## 🌍 Catálogo Maestro (v2.1.0)

Nueva funcionalidad para configurar qué bolsas mundiales alimentan el sistema:

*   **Ubicación UI**: Admin → Mercado → Catálogo Maestro
*   **Endpoints**:
    *   `GET /admin/market/exchanges`: Lista bolsas disponibles (EODHD) y seleccionadas.
    *   `POST /admin/market/exchanges`: Guarda configuración + limpieza profunda.
*   **Archivos clave**:
    *   `server/utils/exchangeMapping.ts`: Mapeo de 50+ bolsas.
    *   `src/components/admin/MasterCatalogConfig.tsx`: Componente UI.
*   **Flujo de limpieza**: Al desmarcar una bolsa → elimina `global_tickers`, `ticker_details_cache`, `market_discovery_cache`.

---

## 💡 Estado Actual del Proyecto (v2.1.0)
El sistema ha alcanzado un estado de madurez y estabilidad (**v2.1.0**).
Se ha priorizado el **rendimiento y configurabilidad** en esta última iteración:
1.  **Catálogo Maestro Configurable**: UI para seleccionar bolsas sin editar código.
2.  **Crawler Eficiente**: Mismos ciclos de 3 min pero con procesamiento en lotes.
3.  **Regiones Dinámicas**: Discovery Job lee configuración de `system_settings`.
4.  **Seguridad Financiera**: Transacciones SQL atómicas.
5.  **UX**: Carga diferida (Lazy Loading) y manejo robusto de errores.
