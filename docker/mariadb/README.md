# Generación Automática de Credenciales - MariaDB

Este directorio contiene los scripts necesarios para la generación automática y segura de credenciales de MariaDB durante la primera instalación.

## Archivos

### `Dockerfile`
Dockerfile personalizado de MariaDB que:
- Usa MariaDB 11.2 como base
- Copia e integra los scripts de inicialización
- Configura el entrypoint personalizado

### `init-credentials.sh`
Script principal de generación de credenciales que:
- Se ejecuta automáticamente en el **primer arranque** del contenedor MariaDB
- Genera credenciales aleatorias seguras (32 caracteres):
  - Usuario MariaDB (10 caracteres alfanuméricos)
  - Contraseña MariaDB (32 caracteres con símbolos)
  - Contraseña Root (32 caracteres con símbolos)
- Guarda las credenciales en `/run/secrets/db_credentials` (compartido con backend)
- Muestra las credenciales generadas en los logs (solo la primera vez)
- Crea un marcador para evitar regeneración en reinicios

### `secure-mariadb.sql`
Script SQL de hardening que:
- Elimina usuarios anónimos
- Remueve acceso remoto a root
- Elimina la base de datos de test
- Actualiza privilegios

Se ejecuta automáticamente durante la inicialización de MariaDB (`/docker-entrypoint-initdb.d/`).

## Flujo de Generación de Credenciales

### Primera Instalación (`docker compose up -d`):

1. **MariaDB inicia** → `init-credentials.sh` se ejecuta
2. **Detecta primera instalación** (no existe `/docker-entrypoint-initdb.d/.credentials_generated`)
3. **Genera credenciales aleatorias**
4. **Guarda en**:
   - `/run/secrets/db_credentials` (compartido con backend)
   - `/var/lib/mysql/.generated_credentials` (volumen persistente)
5. **Muestra en logs** las credenciales generadas
6. **Marca como inicializado** (evita regeneración)
7. **Backend lee credenciales** de `/run/secrets/db_credentials`
8. **Backend actualiza** `/app/env/.env` con las credenciales

### Reinicios Posteriores:

1. **MariaDB inicia** → `init-credentials.sh` se ejecuta
2. **Detecta inicialización previa** (existe el marcador)
3. **Usa credenciales existentes** del volumen persistente
4. **NO regenera** (evita roturas)

## Seguridad

### Credenciales Generadas
- **Entropía**: ~191 bits (contraseñas de 32 caracteres)
- **Caracteres**: Mayúsculas, minúsculas, números, símbolos
- **Algoritmo**: `/dev/urandom` (criptográficamente seguro)

### Almacenamiento
- **Volumen compartido** (`db_secrets`): Solo lectura para backend
- **Permisos restrictivos**: chmod 600 en archivos de credenciales
- **Persistencia**: Credenciales guardadas en volumen `mariadb_data`

### Hardening
- **Sin usuarios anónimos**
- **Root solo local**
- **Sin base de datos test**
- **Privilegios actualizados**

## Ubicación de Credenciales

### Dentro del Contenedor MariaDB
- `/run/secrets/db_credentials` (temporal, compartido)
- `/var/lib/mysql/.generated_credentials` (persistente)
- `/docker-entrypoint-initdb.d/.credentials_generated` (marcador)

### Dentro del Contenedor Backend
- `/run/secrets/db_credentials` (solo lectura)
- `/app/env/.env` (sincronizado automáticamente)

### En el Host
Para ver lasCredenciales después de la instalación:
```bash
# Ver credenciales en el volumen de MariaDB
docker compose exec mariadb cat /var/lib/mysql/.generated_credentials

# Ver credenciales en el backend
docker compose exec server cat /app/env/.env

# Ver en los logs (solo primera vez)
docker compose logs mariadb | grep "CREDENCIALES"
```

## Recuperación de Credenciales Perdidas

Si pierdes las credenciales:

1. **Ver en volumen persistente**:
   ```bash
   docker compose exec mariadb cat /var/lib/mysql/.generated_credentials
   ```

2. **Ver en backend**:
   ```bash
   docker compose exec server cat /app/env/.env
   ```

3. **Último recurso - Reinicialización completa**:
   ```bash
   # ⚠️ ESTO BORRARÁ TODOS LOS DATOS
   docker compose down -v
   docker compose up -d
   # Se generarán nuevas credenciales
   ```

## Migración de Instalaciones Existentes

Si ya tienes una instalación con credenciales hardcodeadas:

### Opción 1: Con Datos (Migración)
1. Hacer backup completo
2. Detener servicios: `docker compose down`
3. Actualizar código (pull)
4. Reconstruir: `docker compose build --no-cache`
5. Iniciar: `docker compose up -d`
6. Las credenciales viejas seguirán funcionando (en volumen)
7. Para usar credenciales nuevas: `docker compose down -v && docker compose up -d` (perderás datos)

### Opción 2: Sin Datos (Reinstalación Limpia)
1. Detener y limpiar: `docker compose down -v`
2. Actualizar código (pull)
3. Iniciar: `docker compose up -d`
4. Nuevas credenciales se generan automáticamente

## Troubleshooting

### "Credenciales no encontradas"
- El backend no puede leer `/run/secrets/db_credentials`
- **Solución**: Verificar que el volumen `db_secrets` está montado:
  ```bash
  docker compose down
  docker compose up -d
  ```

### "Error de conexión a MariaDB"
- Las credenciales no coinciden
- **Solución**: Ver logs de ambos contenedores:
  ```bash
  docker compose logs mariadb
  docker compose logs server
  ```

### "Credenciales se regeneran en cada reinicio"
- El marcador no se guardó correctamente
- **Solución**: Verificar permisos del volumen `mariadb_data`

## Notas Importantes

- ⚠️ **NO** editar manualmente `/docker-entrypoint-initdb.d/.credentials_generated`
- ⚠️ **NO** eliminar el volumen `db_secrets` si hay datos
- ✅ **SÍ** guardar las credenciales mostradas en logs en la primera instalación
- ✅ **SÍ** hacer backups regulares del volumen `mariadb_data`
