# 🔐 Resetear Contraseña de Administrador

Este documento explica cómo resetear la contraseña del usuario administrador directamente en MongoDB.

## 📋 Métodos Disponibles

### Método 1: Script NPM (Recomendado)

#### Desde el host (si tienes acceso al código):

```bash
cd server
npm run reset-admin-password <nueva-contraseña> [username]
```

**Ejemplos:**
```bash
# Resetear contraseña del usuario 'admin' (por defecto)
npm run reset-admin-password miNuevaPassword123

# Resetear contraseña de un usuario específico
npm run reset-admin-password miNuevaPassword123 admin
```

#### Desde Docker:

```bash
# Ejecutar el script dentro del contenedor
docker-compose exec backend npm run reset-admin-password miNuevaPassword123
```

### Método 2: Ejecutar el script directamente

#### Desde el host:

```bash
cd server
node scripts/resetAdminPassword.js <nueva-contraseña> [username]
```

#### Desde Docker:

```bash
docker-compose exec backend node scripts/resetAdminPassword.js miNuevaPassword123
```

### Método 3: Usando la interfaz web

1. Ve a: http://localhost:80/resetadmin
2. Ingresa la contraseña maestra (la que se generó automáticamente)
3. Ingresa la nueva contraseña para el admin
4. Confirma la nueva contraseña

## 🔧 Requisitos

- La contraseña debe tener al menos 6 caracteres
- El usuario debe existir en la base de datos
- Debes tener acceso a MongoDB (local o remoto)

## 📝 Notas

- La contraseña se hashea automáticamente con bcrypt antes de guardarse
- El script funciona tanto con MongoDB local como con MongoDB Atlas
- Si no especificas el username, se usará 'admin' por defecto
- El script carga automáticamente las variables de entorno desde `server/.env`

## 🐛 Solución de Problemas

### Error: "No se encontró el usuario"

Verifica que el usuario existe:
```bash
# Desde Docker
docker-compose exec backend node -e "const mongoose = require('mongoose'); const User = require('./models/User.js'); mongoose.connect(process.env.MONGODB_URI).then(() => User.find().then(users => console.log(users.map(u => ({username: u.username, isAdmin: u.isAdmin})))));"
```

### Error: "Debes proporcionar una nueva contraseña"

Asegúrate de pasar la contraseña como argumento:
```bash
npm run reset-admin-password "mi contraseña con espacios"
```

### Error de conexión a MongoDB

Verifica que:
- MongoDB está corriendo (si es local)
- La variable `MONGODB_URI` está correctamente configurada en `server/.env`
- Tienes acceso a la base de datos

## 🔒 Seguridad

- ⚠️ **NUNCA** compartas tu contraseña
- ⚠️ **NUNCA** subas el archivo `.env` a Git
- ⚠️ Cambia la contraseña después del primer login
- ⚠️ Usa contraseñas seguras (mínimo 12 caracteres, con mayúsculas, minúsculas, números y símbolos)

