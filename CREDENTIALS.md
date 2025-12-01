# Credenciales de Base de Datos Generadas Automáticamente

Este archivo contiene las credenciales de la base de datos que fueron generadas automáticamente durante la primera instalación.

**⚠️ ADVERTENCIA DE SEGURIDAD:**
Este archivo contiene información sensible. NO lo compartas públicamente ni lo subas a repositorios git.

**Fecha de generación:** (ver logs de docker para fecha exacta)

## Ubicación de Credenciales

Las credenciales reales se almacenan en:
- Contenedor MariaDB: `/var/lib/mysql/.generated_credentials`
- Contenedor Backend: `/app/env/.env`
- Volumen compartido: `/run/secrets/db_credentials`

## Cómo Ver las Credenciales

```bash
# Desde el contenedor de MariaDB
docker compose exec mariadb cat /var/lib/mysql/.generated_credentials

# Desde el contenedor del backend
docker compose exec server cat /app/env/.env

# Desde los logs (solo si fue la primera instalación reciente)
docker compose logs mariadb | grep -A 10 "CREDENCIALES"
docker compose logs server | grep -A 10 "MASTER_PASSWORD"
```

## Credenciales Generadas

Las siguientes credenciales fueron generadas automáticamente:

- **MYSQL_USER**: (usuario aleatorio de 10 caracteres)
- **MYSQL_PASSWORD**: (contraseña aleatoria de 32 caracteres)
- **MYSQL_ROOT_PASSWORD**: (contraseña aleatoria de 32 caracteres)
- **MYSQL_DATABASE**: portfolio_manager
- **JWT_SECRET**: (secreto aleatorio de 64 caracteres)
- **MASTER_PASSWORD**: (frase memorable para recuperación)

## Importante

1. **MASTER_PASSWORD** es necesaria para recuperar el acceso de administrador
2. Las credenciales están guardadas de forma segura en los volúmenes de Docker
3. Si necesitas las credenciales, usa los comandos de arriba
4. NO edites manualmente los archivos de credenciales en los volúmenes

## En Caso de Pérdida

Si pierdes acceso a las credenciales:

1. Usa los comandos de arriba para recuperarlas
2. Si no funcionan, revisa los logs de docker
3. Como último recurso, puedes reinicializar (⚠️ perderás todos los datos):
   ```bash
   docker compose down -v
   docker compose up -d
   ```

---

**Este archivo es solo informativo. Las credenciales reales están en los volúmenes de Docker.**
