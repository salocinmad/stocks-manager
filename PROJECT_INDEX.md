# 🗂️ Stocks Manager - Project Index

> **Versión**: v2.1.0 (Stable)  
> **Estado**: Optimizado (Lazy Loading, Atomic Tx, Crawler Batching)  
> **Fecha**: 7 Enero 2026

Este documento sirve como índice maestro para navegar por el código fuente y la documentación del proyecto **Stocks Manager**.

## 📚 Documentación Clave

*   **[memoria.md](./memoria.md)**: Visión global del proyecto, arquitectura y estado actual. (Lectura obligatoria para IA).
*   **[API_CATALOG.md](./API_CATALOG.md)**: Catálogo detallado de endpoints del Backend (`/auth`, `/portfolios`, etc.).
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
*   `/services/api.ts`: Cliente HTTP (Axios) para comunicarse con el Backend.

### Backend (`/server`)
*   `index.ts`: Punto de entrada. Configura servidor y Cron Jobs.
*   `db.ts`: Conexión a Base de Datos.
*   `/routes`: Endpoints de la API (ver `API_CATALOG.md`).
*   `/services`: Lógica de negocio (Discovery, Portfolio, MarketData).
*   `/jobs`: Tareas en segundo plano (Crawler, Backups).
    *   `discoveryJob.ts`: Crawler optimizado (Lotes + Paralelo).
    *   `backupJob.ts`: Sistema de copias de seguridad.

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

### Gestión
```bash
# Copia de seguridad manual
docker exec stocks_app curl -X POST http://localhost:3000/api/admin/backups/create

# Resetear BBDD (Peligroso)
docker compose down -v
```

---

## 💡 Estado Actual del Proyecto (v2.1.0)
El sistema ha alcanzado un estado de madurez y estabilidad (**v2.1.0**).
Se ha priorizado el **rendimiento** en esta última iteración:
1.  **Crawler Agresivo pero Eficiente**: Mantiene ciclos de 3 min pero usa procesamiento en lotes para no saturar la CPU/DB.
2.  **Seguridad Financiera**: Todas las operaciones monetarias usan transacciones SQL atómicas.
3.  **UX**: Carga diferida y manejo robusto de errores.
