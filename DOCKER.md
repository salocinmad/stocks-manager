# Guía Docker

## Construcción y arranque
- Construir todas las imágenes:
  - `docker compose build`
- Construcción completa sin caché:
  - `docker compose build --no-cache`
- Arrancar en segundo plano:
  - `docker compose up -d`
- Parar servicios:
  - `docker compose down`

## Servicios
- Base de datos (MariaDB): `mariadb`
- Backend (Express): `server`
- Frontend (Vite/React): `frontend`

## Logs
- Todos los servicios:
  - `docker compose logs -f`
- Servicio específico:
  - `docker compose logs -f server`

## Ejecutar comandos dentro de contenedores
- Shell en backend:
  - `docker compose exec server sh`
- Cliente MariaDB:
  - `docker compose exec mariadb sh -lc "mariadb -u \"$MYSQL_USER\" -p\"$MYSQL_PASSWORD\" \"$MYSQL_DATABASE\""`

## Backup y Restore
- Backup SQL (MariaDB):
  - `docker compose exec mariadb sh -lc 'mariadb-dump -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" > /tmp/stocks_backup_$(date +%F_%H%M).sql'`
  - Copiar al host:
    - `docker compose cp mariadb:/tmp/stocks_backup_YYYY-MM-DD_HHMM.sql .`
- Restore SQL:
  - `docker compose exec -T mariadb sh -lc 'mariadb -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < ./stocks_backup_YYYY-MM-DD_HHMM.sql`

## Reconstrucciones parciales
- Solo frontend:
  - `docker compose build frontend --no-cache && docker compose up -d`
- Solo backend:
  - `docker compose build server --no-cache && docker compose up -d`

## Variables de entorno
- Definidas en `.env` o en `docker-compose.yml`.
- Ejemplos:
  - `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`
  - `VITE_API_URL=/api`

## Troubleshooting
- Puertos ocupados:
  - Ver qué escucha: `netstat -ano` (Windows) / `lsof -i` (Linux).
- Caché de navegador:
  - Recarga forzada: `Ctrl+F5`.
- Reconstrucción forzada:
  - `docker compose build --no-cache && docker compose up -d`

