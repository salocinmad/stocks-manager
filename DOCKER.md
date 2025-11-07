# 🐳 Guía de Dockerización - Stocks Manager

Esta guía explica cómo ejecutar Stocks Manager usando Docker Compose.

## 📋 Requisitos Previos

- Docker instalado ([Descargar Docker](https://www.docker.com/get-started))
- Docker Compose instalado (viene incluido con Docker Desktop)

## 🚀 Inicio Rápido

### 1. Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/stocks-manager.git
cd stocks-manager
```

### 2. Elegir la versión de MongoDB

El proyecto incluye dos archivos Docker Compose:

- **`docker-compose.yml`** (por defecto): Usa **MongoDB 7.0** - Requiere CPU con soporte AVX (versión estándar y más moderna)
- **`docker-compose.mongo4.4.yml`**: Usa **MongoDB 4.4** - Compatible con CPUs sin soporte AVX (excepción para CPUs antiguos)

**¿Cuál usar?**
- **Por defecto**, usa `docker-compose.yml` (MongoDB 7.0) - La mayoría de CPUs modernas soportan AVX
- Si tu CPU **NO soporta AVX** o recibes el error `MongoDB 5.0+ requires a CPU with AVX support`, usa `docker-compose.mongo4.4.yml` (MongoDB 4.4)

### 3. Iniciar la aplicación

**Con MongoDB 7.0 (por defecto, requiere AVX):**
```bash
docker-compose up -d
```

**Con MongoDB 4.4 (si tu CPU no soporta AVX):**
```bash
docker-compose -f docker-compose.mongo4.4.yml up -d
```

Este comando:
- Construye las imágenes de Docker
- Crea los contenedores
- Inicia MongoDB, Backend y Frontend
- **Genera automáticamente el archivo `.env`** con una contraseña maestra única

### 3. Ver los logs

```bash
docker-compose logs -f
```

Busca en los logs la línea que dice:
```
🔐 CONTRASEÑA MAESTRA GENERADA:
   [tu-contraseña-aquí]
```

**⚠️ IMPORTANTE**: Guarda esta contraseña en un lugar seguro. La necesitarás para:
- Recuperar la contraseña de administrador en `/resetadmin`
- Acceder a funciones administrativas

### 4. Acceder a la aplicación

- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:3001
- **MongoDB**: localhost:27017

**Nota**: El frontend usa el puerto 8080 por defecto para evitar conflictos con otros servicios. Si el puerto 80 está libre, puedes cambiarlo en `docker-compose.yml`.

### 5. Credenciales iniciales

- **Usuario**: `admin`
- **Contraseña**: `admin123`

**⚠️ IMPORTANTE**: Cambia la contraseña después del primer login.

## 📝 Características Automáticas

### Generación Automática de `.env`

La primera vez que se inicia el contenedor, se genera automáticamente un archivo `.env` con:

- `PORT=3001` - Puerto del servidor backend
- `MONGODB_URI=mongodb://mongo:27017/portfolio-manager` - Conexión a MongoDB local
- `CORS_ORIGIN=http://localhost:8080` - Origen permitido para CORS
- `JWT_SECRET=[generado automáticamente]` - Secret para tokens JWT
- `MASTER_PASSWORD=[generado automáticamente]` - Contraseña maestra única

**La contraseña maestra se genera de forma aleatoria y única para cada instalación.**

### Inicialización Automática

El contenedor ejecuta automáticamente:

1. ✅ Generación de `.env` (si no existe)
2. ✅ Espera a que MongoDB esté disponible
3. ✅ Creación del usuario administrador (si no existe)
4. ✅ Inicio del servidor backend

## 🛠️ Comandos Útiles

**Nota**: Si usas `docker-compose.mongo4.4.yml`, añade `-f docker-compose.mongo4.4.yml` a todos los comandos.

### Detener la aplicación

```bash
# MongoDB 7.0 (por defecto)
docker-compose down

# MongoDB 4.4 (si tu CPU no soporta AVX)
docker-compose -f docker-compose.mongo4.4.yml down
```

### Detener y eliminar volúmenes (⚠️ elimina datos)

```bash
# MongoDB 7.0 (por defecto)
docker-compose down -v

# MongoDB 4.4 (si tu CPU no soporta AVX)
docker-compose -f docker-compose.mongo4.4.yml down -v
```

### Ver logs del backend

```bash
# MongoDB 7.0 (por defecto)
docker-compose logs -f backend

# MongoDB 4.4 (si tu CPU no soporta AVX)
docker-compose -f docker-compose.mongo4.4.yml logs -f backend
```

### Ver logs de MongoDB

```bash
# MongoDB 7.0 (por defecto)
docker-compose logs -f mongo

# MongoDB 4.4 (si tu CPU no soporta AVX)
docker-compose -f docker-compose.mongo4.4.yml logs -f mongo
```

### Reiniciar un servicio específico

```bash
# MongoDB 7.0 (por defecto)
docker-compose restart backend

# MongoDB 4.4 (si tu CPU no soporta AVX)
docker-compose -f docker-compose.mongo4.4.yml restart backend
```

### Reconstruir las imágenes

```bash
# MongoDB 7.0 (por defecto)
docker-compose build --no-cache
docker-compose up -d

# MongoDB 4.4 (si tu CPU no soporta AVX)
docker-compose -f docker-compose.mongo4.4.yml build --no-cache
docker-compose -f docker-compose.mongo4.4.yml up -d
```

### Cambiar entre versiones de MongoDB

Si quieres cambiar de MongoDB 7.0 a MongoDB 4.4 (o viceversa):

1. **Detén los contenedores actuales:**
   ```bash
   docker-compose down
   ```

2. **Inicia con la otra versión:**
   ```bash
   # Para MongoDB 7.0 (por defecto)
   docker-compose up -d
   
   # Para MongoDB 4.4 (si tu CPU no soporta AVX)
   docker-compose -f docker-compose.mongo4.4.yml up -d
   ```

**⚠️ Nota**: Los volúmenes de datos son compartidos, por lo que tus datos se mantendrán al cambiar de versión.

## 🔧 Configuración Avanzada

### Persistir el archivo `.env`

El archivo `.env` se almacena automáticamente en un volumen nombrado (`backend_env`), lo que garantiza:
- ✅ Persistencia entre reinicios del contenedor
- ✅ Compatibilidad con Portainer y otros orquestadores
- ✅ No requiere que el archivo exista en el host

**Para desarrollo local con bind mount** (opcional):

Si prefieres tener el `.env` en tu máquina local, puedes cambiar en `docker-compose.yml`:

```yaml
volumes:
  - ./server/.env:/app/.env  # Bind mount (requiere que el archivo exista)
```

**Nota**: En Portainer, usa el volumen nombrado (configuración por defecto).

### Usar MongoDB Atlas en lugar de MongoDB local

1. Obtén tu connection string de MongoDB Atlas
2. Edita el archivo `.env` dentro del contenedor o usa un bind mount
3. Cambia `MONGODB_URI` a tu connection string de Atlas

### Cambiar puertos

Edita `docker-compose.yml`:

```yaml
ports:
  - "80:80"    # Cambiar a puerto 80 si está libre
  - "8080:80"  # Puerto actual del frontend
  - "3002:3001"  # Cambiar puerto del backend
```

**Importante**: Si cambias el puerto del frontend, también actualiza `CORS_ORIGIN` en el `.env`:
```bash
CORS_ORIGIN=http://localhost:80  # O el puerto que uses
```

## 🔐 Resetear Contraseña de Administrador

Si olvidaste la contraseña del administrador, puedes resetearla directamente desde MongoDB:

### Desde Docker:

```bash
docker-compose exec backend npm run reset-admin-password miNuevaPassword123
```

O ejecutando el script directamente:

```bash
docker-compose exec backend node scripts/resetAdminPassword.js miNuevaPassword123
```

**Ejemplos:**
```bash
# Resetear contraseña del usuario 'admin' (por defecto)
docker-compose exec backend npm run reset-admin-password miNuevaPassword123

# Resetear contraseña de un usuario específico
docker-compose exec backend npm run reset-admin-password miNuevaPassword123 otroUsuario
```

**Requisitos:**
- La contraseña debe tener al menos 6 caracteres
- El usuario debe existir en la base de datos

Para más información, consulta [RESET_ADMIN_PASSWORD.md](RESET_ADMIN_PASSWORD.md).

## 🐛 Solución de Problemas

### El contenedor no inicia

```bash
docker-compose logs backend
```

### MongoDB no está disponible

Verifica que el contenedor de MongoDB esté corriendo:

```bash
docker-compose ps
```

### No puedo ver la contraseña maestra

```bash
docker-compose logs backend | grep "CONTRASEÑA MAESTRA"
```

### Reiniciar desde cero

```bash
docker-compose down -v
docker-compose up -d
```

## 📦 Estructura de Contenedores

- **mongo**: Base de datos MongoDB (puerto 27017)
- **backend**: API Node.js/Express (puerto 3001)
- **frontend**: Aplicación React con Nginx (puerto 8080)

## 🐳 Despliegue en Portainer

### Requisitos

- Portainer instalado y funcionando
- Acceso al repositorio Git (GitHub, GitLab, etc.)

### Pasos para Desplegar

1. **En Portainer, ve a "Stacks"**
2. **Haz clic en "Add stack"**
3. **Configura el stack**:
   - **Name**: `stocks-manager` (o el nombre que prefieras)
   - **Build method**: Selecciona "Repository"
   - **Repository URL**: URL de tu repositorio Git
   - **Repository reference**: `main` (o la rama que uses)
   - **Compose path**: 
     - `docker-compose.yml` (MongoDB 7.0 - por defecto, requiere CPU con AVX)
     - `docker-compose.mongo4.4.yml` (MongoDB 4.4 - compatible con CPUs sin AVX)
4. **Haz clic en "Deploy the stack"**

**Nota sobre MongoDB**: Por defecto se usa MongoDB 7.0. Si tu servidor NO tiene CPU con soporte AVX o recibes errores de AVX, cambia el **Compose path** a `docker-compose.mongo4.4.yml`.

### Configuración del Puerto

Si el puerto 80 está ocupado en tu servidor, el stack usará el puerto 8080 por defecto. Para cambiarlo:

1. Edita el stack en Portainer
2. Modifica la sección `ports` del servicio `frontend`:
   ```yaml
   ports:
     - "80:80"  # Si el puerto 80 está libre
   ```
3. Guarda y reinicia el stack

### Acceder al Archivo `.env`

El archivo `.env` se almacena en un volumen nombrado. Para acceder a él:

1. **Ver la contraseña maestra**:
   - Ve a "Containers" → `stocks-manager-backend`
   - Haz clic en "Logs"
   - Busca la línea: `🔐 CONTRASEÑA MAESTRA GENERADA:`

2. **Editar el `.env` manualmente**:
   - Ve a "Volumes"
   - Busca el volumen `stocks-manager_backend_env`
   - Puedes montarlo temporalmente en otro contenedor para editarlo

3. **Usar el script de reset**:
   ```bash
   # Desde la terminal del contenedor backend
   docker exec -it stocks-manager-backend npm run reset-admin-password nuevaPassword123
   ```

### Solución de Problemas en Portainer

#### Error: "Port 80 already in use"
- **Solución**: El stack ya está configurado para usar el puerto 8080. Si necesitas el puerto 80, detén el servicio que lo está usando.

#### Error: "Bind mount failed: '/data/compose/X/server/.env' does not exist"
- **Solución**: Ya está resuelto. El stack ahora usa un volumen nombrado que se crea automáticamente.

#### El stack no aparece en la lista
- Verifica que el despliegue se completó correctamente
- Revisa los logs del stack en "Stacks" → Tu stack → "Logs"
- Verifica que los contenedores se crearon en "Containers"

#### No puedo ver la contraseña maestra
- Ve a "Containers" → `stocks-manager-backend` → "Logs"
- Busca la línea que contiene "CONTRASEÑA MAESTRA GENERADA"
- Si no aparece, el `.env` ya existía. Reinicia el contenedor o elimina el volumen `backend_env` para regenerarlo

## 🔐 Seguridad

- La contraseña maestra se genera automáticamente y es única para cada instalación
- El JWT_SECRET se genera automáticamente
- Las contraseñas se hashean con bcrypt antes de guardarse
- El archivo `.env` contiene información sensible, no lo subas a Git

## 📚 Más Información

Para más detalles sobre el proyecto, consulta el [README.md](README.md).

