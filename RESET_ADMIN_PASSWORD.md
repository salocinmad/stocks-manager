# 🔐 Restablecer Contraseña de Administrador

Esta guía explica cómo restablecer la contraseña del administrador si la has olvidado.

## Método 1: Usando /resetadmin (Recomendado) ⭐

Este es el método más sencillo y seguro. Utiliza la **contraseña maestra** que se genera automáticamente cuando se inicia el servidor por primera vez.

### ¿Dónde encontrar la contraseña maestra?

La contraseña maestra se muestra en los logs del servidor la primera vez que se ejecuta:

```bash
# Ver logs del servidor
docker compose logs server

# Busca una línea similar a:
🔐 CONTRASEÑA MAESTRA GENERADA: Freedom2-Mud9-Garnish7-Tattle4-Vivacious4-Germinate3-Removal9-Harmonics5-Heave6
   - Guarda esta contraseña en un lugar seguro
   - Puedes acceder a /resetadmin para recuperar la contraseña de admin
```

**Importante:** Esta contraseña también se guarda en la variable de entorno `MASTER_PASSWORD` en el archivo `.env`.

### Pasos para restablecer

1. **Accede a la ruta de recuperación**
   
   Abre tu navegador y ve a:
   ```
   http://localhost:3000/resetadmin
   ```
   O en producción:
   ```
   https://tu-dominio.com/resetadmin
   ```

2. **Completa el formulario**
   - **Contraseña Maestra**: Ingresa la contraseña maestra (la que viste en los logs o en `.env`)
   - **Nueva Contraseña**: Ingresa la nueva contraseña para el administrador (mínimo 6 caracteres)
   - **Confirmar Nueva Contraseña**: Repite la nueva contraseña

3. **Recuperar contraseña**
   
   Haz clic en "Recuperar Contraseña". Si todo es correcto, verás un mensaje de éxito y serás redirigido al login.

4. **Iniciar sesión**
   
   Inicia sesión con:
   - Usuario: `admin`
   - Contraseña: la nueva contraseña que acabas de configurar

### Verificar la contraseña maestra

Si no recuerdas la contraseña maestra, puedes verificarla en:

**Opción A - Archivo .env:**
```bash
cat .env | grep MASTER_PASSWORD
```

**Opción B - Logs del servidor:**
```bash
docker compose logs server | grep "CONTRASEÑA MAESTRA"
```

**Opción C - Variable de entorno del contenedor:**
```bash
docker compose exec server printenv MASTER_PASSWORD
```

---

## Método 2: Usando Docker y Base de Datos

Si no tienes acceso a la contraseña maestra, puedes restablecer directamente en la base de datos.

### Paso 1: Acceder al contenedor de la base de datos

```bash
docker compose exec database mysql -u root -p
```

Ingresa la contraseña root de la base de datos (configurada en `DB_ROOT_PASSWORD` del archivo `.env`).

### Paso 2: Generar hash de la nueva contraseña

Primero, necesitas generar un hash bcrypt de tu nueva contraseña. Puedes usar Node.js:

```bash
# Acceder al contenedor del servidor
docker compose exec server node

# En la consola de Node.js, ejecuta:
const bcrypt = require('bcrypt');
bcrypt.hash('tu_nueva_contraseña', 10).then(hash => console.log(hash));

# Copia el hash generado y sal con Ctrl+C dos veces
```

### Paso 3: Actualizar la contraseña en la base de datos

```sql
USE portfolio;

UPDATE users 
SET password = 'HASH_GENERADO_EN_PASO_2' 
WHERE username = 'admin';

-- Verificar el cambio
SELECT username, password FROM users WHERE username = 'admin';

-- Salir
EXIT;
```

### Paso 4: Reiniciar el servidor

```bash
docker compose restart server
```

---

## Método 3: Recrear Usuario Administrador

Si prefieres recrear el usuario desde cero:

### Paso 1: Acceder a la base de datos

```bash
docker compose exec database mysql -u root -p
```

### Paso 2: Eliminar y recrear el usuario

```sql
USE portfolio;

-- Eliminar usuario existente
DELETE FROM users WHERE username = 'admin';

-- Crear nuevo usuario con contraseña hasheada
-- Reemplaza 'HASH_AQUI' con el hash bcrypt de tu contraseña
INSERT INTO users (username, password, isAdmin) 
VALUES ('admin', 'HASH_AQUI', true);

-- Verificar
SELECT * FROM users;

EXIT;
```

---

## Método 4: Restablecer desde Variables de Entorno

Si tienes acceso al archivo `.env` y no te importa perder los datos:

### Paso 1: Modificar ADMIN_PASSWORD

Edita el archivo `.env` y cambia:
```bash
ADMIN_PASSWORD=nueva_contraseña_segura
```

### Paso 2: Recrear la base de datos

⚠️ **ADVERTENCIA**: Esto eliminará TODOS los datos.

```bash
# Detener servicios
docker compose down

# Eliminar volumen de base de datos
docker volume rm stocks-manager_mariadb-data

# Reiniciar servicios (se creará nuevo admin)
docker compose up -d
```

---

## Generar Hash Bcrypt

### Opción 1: Usando Node.js (en el servidor)

```bash
# Acceder al contenedor
docker compose exec server sh

# Ejecutar Node.js
node

# En la consola de Node.js
const bcrypt = require('bcrypt');
bcrypt.hash('mi_nueva_contraseña', 10).then(hash => console.log(hash));

# Copiar el hash y salir con Ctrl+C dos veces
```

### Opción 2: Usando script local

Crea un archivo `generate_hash.js`:

```javascript
const bcrypt = require('bcrypt');

const password = process.argv[2] || 'admin';
bcrypt.hash(password, 10).then(hash => {
    console.log('Password:', password);
    console.log('Hash:', hash);
});
```

Ejecuta:
```bash
node generate_hash.js tu_nueva_contraseña
```

---

## Verificación

Después de restablecer la contraseña:

1. ✅ Intenta iniciar sesión con las nuevas credenciales
2. ✅ Verifica que puedas acceder a todas las funciones
3. ✅ Cambia la contraseña desde la interfaz para mayor seguridad

---

## Prevención

Para evitar perder el acceso en el futuro:

1. **Documenta la contraseña maestra** en un gestor de contraseñas seguro
2. **Guarda el archivo .env** en un lugar seguro (nunca en el repositorio)
3. **Haz backups regulares** de la base de datos
4. **Anota la contraseña de admin** en un lugar seguro

---

## Backups de Seguridad

Antes de hacer cambios, siempre haz un backup:

```bash
# Backup de la base de datos completa
docker compose exec database mysqldump -u root -p portfolio > backup_$(date +%Y%m%d).sql

# Backup solo de la tabla users
docker compose exec database mysqldump -u root -p portfolio users > users_backup.sql
```

### Restaurar desde Backup

Si algo sale mal:

```bash
# Restaurar base de datos completa
docker compose exec -T database mysql -u root -p portfolio < backup_20231123.sql

# Restaurar solo tabla users
docker compose exec -T database mysql -u root -p portfolio < users_backup.sql
```

---

## Soporte

Si tienes problemas:
1. Verifica los logs: `docker compose logs server`
2. Asegúrate de que la base de datos esté corriendo: `docker compose ps`
3. Verifica la conexión a la base de datos
4. Consulta el README principal para más información

---

**Nota de Seguridad**: 
- Nunca compartas la contraseña maestra públicamente
- Guarda la contraseña maestra en un lugar seguro
- No commitees el archivo `.env` al repositorio
- Cambia la contraseña maestra en producción
