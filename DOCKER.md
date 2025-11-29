# 🐳 Guía de Infraestructura y Docker

Esta guía técnica detalla los comandos esenciales para gestionar la infraestructura de Stocks Manager usando Docker Compose, así como procedimientos de respaldo y recuperación.

## 🚀 Comandos Básicos

### Iniciar y Detener
- **Arrancar todo (segundo plano)**:
  ```bash
  docker compose up -d
  ```
- **Detener todo**:
  ```bash
  docker compose down
  ```
- **Reiniciar un servicio** (ej. `server` o `frontend`):
  ```bash
  docker compose restart server
  ```

### Actualización y Reconstrucción
Si has actualizado el código o cambiado dependencias:

- **Reconstruir todo**:
  ```bash
  docker compose build --no-cache
  docker compose up -d
  ```
- **Reconstruir solo frontend** (útil si no ves cambios visuales):
  ```bash
  docker compose build frontend --no-cache && docker compose up -d
  ```

### Ver Logs
Para depurar errores o verificar el estado del sistema:

- **Ver logs de todo** (seguimiento en tiempo real):
  ```bash
  docker compose logs -f
  ```
- **Ver logs específicos** (ej. backend):
  ```bash
  docker compose logs -f server
  ```

---

## 💾 Backups y Restauración

Es **crítico** realizar copias de seguridad periódicas de tu base de datos.

### Crear un Backup (Exportar)
Este comando genera un archivo `.sql` con todos los datos (usuarios, portafolios, operaciones) en tu directorio actual.

```bash
# Genera un archivo con fecha y hora: stocks_backup_YYYYMMDD_HHMM.sql
docker compose exec mariadb sh -lc 'mariadb-dump -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' > stocks_backup_$(date +%Y%m%d_%H%M).sql
```

### Restaurar un Backup (Importar)
⚠️ **Advertencia**: Esto sobrescribirá todos los datos actuales en la base de datos.

1. Coloca el archivo `.sql` en el directorio del proyecto.
2. Ejecuta el comando (reemplaza `ARCHIVO_BACKUP.sql` por el nombre real):

```bash
docker compose exec -T mariadb sh -lc 'mariadb -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < ARCHIVO_BACKUP.sql
```

---

## 🔧 Acceso Avanzado (Shell)

Para ejecutar scripts manuales o inspeccionar el sistema de archivos interno:

- **Backend (Node.js)**:
  ```bash
  docker compose exec server sh
  ```
- **Base de Datos (MariaDB)**:
  ```bash
  docker compose exec mariadb sh -lc "mariadb -u \"$MYSQL_USER\" -p\"$MYSQL_PASSWORD\" \"$MYSQL_DATABASE\""
  ```

---

## ❓ Solución de Problemas (Troubleshooting)

### Puertos ocupados
Error: `port already in use`.
- Verifica qué proceso usa el puerto 80 o 3000.
- Windows: `netstat -ano | findstr :80`
- Linux/Mac: `lsof -i :80`

### Cambios no visibles (Caché)
Si el frontend no muestra tus cambios:
1. **Recarga forzada**: `Ctrl + Shift + R` (o `Cmd + Shift + R`).
2. **Reconstruir contenedor**: Ejecuta el comando de reconstrucción de frontend mencionado arriba.

### Base de datos no conecta
- Verifica que el contenedor `mariadb` esté saludable (`docker compose ps`).
- Revisa los logs: `docker compose logs mariadb`.
- Asegúrate de que las credenciales en `.env` coincidan con las usadas al crear el volumen (si cambias el `.env` después de crear la BD, no se actualizará la contraseña de root automáticamente).
