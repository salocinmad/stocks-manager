# 🐳 Guía de Docker y Mantenimiento

Esta guía detalla los comandos esenciales para gestionar la aplicación Stocks Manager usando Docker Compose.

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
- **Reiniciar un servicio específico** (ej. backend):
  ```bash
  docker compose restart server
  ```

### Construcción
- **Reconstruir todo (recomendado tras actualizaciones)**:
  ```bash
  docker compose build --no-cache
  docker compose up -d
  ```
- **Reconstruir solo frontend**:
  ```bash
  docker compose build frontend --no-cache && docker compose up -d
  ```

### Logs
- **Ver logs de todo**:
  ```bash
  docker compose logs -f
  ```
- **Ver logs del backend**:
  ```bash
  docker compose logs -f server
  ```

---

## 💾 Backups y Restauración (Importante)

Es fundamental realizar copias de seguridad periódicas de tu base de datos.

### Crear un Backup (Exportar)
Este comando crea un archivo `.sql` con todos tus datos (usuarios, portafolios, operaciones) en el directorio actual.

```bash
# Formato: stocks_backup_FECHA_HORA.sql
docker compose exec mariadb sh -lc 'mariadb-dump -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' > stocks_backup_$(date +%Y%m%d_%H%M).sql
```

### Restaurar un Backup (Importar)
⚠️ **Advertencia**: Esto sobrescribirá todos los datos actuales en la base de datos.

1. Asegúrate de tener el archivo `.sql` en el directorio actual.
2. Ejecuta el siguiente comando (reemplaza `ARCHIVO_BACKUP.sql` por el nombre real):

```bash
docker compose exec -T mariadb sh -lc 'mariadb -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < ARCHIVO_BACKUP.sql
```

---

## 🔧 Acceso Avanzado

### Shell dentro de los contenedores
A veces es necesario entrar al contenedor para depurar o ejecutar scripts manuales.

- **Backend (Node.js)**:
  ```bash
  docker compose exec server sh
  ```
- **Base de Datos (MariaDB)**:
  ```bash
  docker compose exec mariadb sh -lc "mariadb -u \"$MYSQL_USER\" -p\"$MYSQL_PASSWORD\" \"$MYSQL_DATABASE\""
  ```

## ❓ Solución de Problemas (Troubleshooting)

### Puertos ocupados
Si al arrancar ves un error de "port already in use", verifica qué proceso está usando el puerto (por defecto 80 o 3000):
- Windows: `netstat -ano | findstr :80`
- Linux/Mac: `lsof -i :80`

### Cambios no visibles (Caché)
Si has actualizado la aplicación pero no ves los cambios en el navegador:
1. Intenta una **recarga forzada**: `Ctrl + Shift + R` (o `Cmd + Shift + R`).
2. Si persiste, reconstruye el contenedor del frontend:
   ```bash
   docker compose build frontend --no-cache && docker compose up -d
   ```
