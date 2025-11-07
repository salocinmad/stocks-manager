****# 📊 Stocks Manager - Gestor de Portfolio de Acciones

Aplicación web completa para gestionar tu cartera de acciones con seguimiento de ganancias/pérdidas en tiempo real, soporte multi-usuario y sincronización entre dispositivos.

## 🚀 Características Principales

- ✅ **Gestión completa de operaciones**: Compra y venta de acciones con seguimiento detallado
- ✅ **Múltiples mercados**: Soporte para NASDAQ, NYSE, BME (Madrid), Frankfurt, y más
- ✅ **Precios en tiempo real**: Integración con Finnhub API (con fallback a Yahoo Finance)
- ✅ **Cálculo automático**: Ganancias/pérdidas con conversión de moneda automática
- ✅ **Visualización**: Gráficos interactivos de inversión vs ganancias
- ✅ **Exportación**: Generación de CSV con todas las operaciones
- ✅ **Multi-usuario**: Sistema de autenticación con portfolios independientes por usuario
- ✅ **Administración**: Panel de administración para gestión de usuarios y configuración
- ✅ **Sincronización**: Acceso desde cualquier dispositivo con MongoDB
- ✅ **Modo claro/oscuro**: Interfaz adaptable con tema personalizable

## 🛠️ Stack Tecnológico

### Frontend
- **React 18** - Framework UI
- **Vite** - Build tool y dev server
- **React Router** - Navegación y rutas protegidas
- **Recharts** - Gráficos y visualización de datos

### Backend
- **Node.js** - Runtime JavaScript
- **Express** - Framework web
- **MongoDB** - Base de datos NoSQL
- **Mongoose** - ODM para MongoDB
- **JWT** - Autenticación con tokens
- **bcrypt** - Hash de contraseñas

### Infraestructura
- **Docker** - Contenedores para desarrollo y producción
- **Docker Compose** - Orquestación de servicios
- **Nginx** - Servidor web para frontend en producción
- **MongoDB Atlas** - Base de datos en la nube (alternativa)

## 📋 Requisitos Previos

- **Node.js** 18 o superior
- **npm** o **yarn**
- **Docker** y **Docker Compose** (para despliegue con contenedores)
- **MongoDB** (local o MongoDB Atlas)

## 🚀 Instalación y Configuración

### Opción 1: Desarrollo Local (Sin Docker)

#### 1. Clonar el repositorio
```bash
git clone <tu-repositorio>
cd Bolsa
```

#### 2. Instalar dependencias

**Frontend:**
```bash
npm install
```

**Backend:**
```bash
cd server
npm install
cd ..
```

#### 3. Configurar variables de entorno

Crear archivo `server/.env`:
```env
# Puerto del servidor backend
PORT=3001

# MongoDB Connection String
# Opción A: MongoDB local
MONGODB_URI=mongodb://localhost:27017/portfolio-manager

# Opción B: MongoDB Atlas (recomendado)
# MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/portfolio-manager?retryWrites=true&w=majority

# CORS - Origen permitido (frontend)
CORS_ORIGIN=http://localhost:5173

# JWT Secret (cambiar en producción)
JWT_SECRET=tu-secret-key-super-segura-cambiar-en-produccion

# Contraseña maestra para recuperación de admin (opcional, tiene valor por defecto)
# MASTER_PASSWORD=tu-contraseña-maestra-personalizada
```

#### 4. Inicializar usuario administrador

```bash
cd server
npm run init-admin
```

Esto creará el usuario administrador por defecto:
- **Usuario**: `admin`
- **Contraseña**: `admin123`
- ⚠️ **IMPORTANTE**: Cambia la contraseña después del primer login

#### 5. Iniciar servicios

**Opción A: Iniciar todo junto (recomendado)**
```bash
npm run dev:all
```

**Opción B: Iniciar por separado**

Terminal 1 - Backend:
```bash
cd server
npm run dev
```

Terminal 2 - Frontend:
```bash
npm run dev
```

#### 6. Acceder a la aplicación

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

### Opción 2: Docker Compose (Recomendado para Producción)

#### 1. Configurar variables de entorno

Crear `server/.env`:
```env
PORT=3001
MONGODB_URI=mongodb://mongo:27017/portfolio-manager
CORS_ORIGIN=http://localhost:80
JWT_SECRET=tu-secret-key-super-segura-cambiar-en-produccion
```

#### 2. Construir y levantar contenedores

```bash
docker-compose up -d --build
```

#### 3. Inicializar usuario administrador

```bash
docker-compose exec backend npm run init-admin
```

#### 4. Acceder a la aplicación

- **Frontend**: http://localhost:80
- **Backend API**: http://localhost:3001
- **MongoDB**: localhost:27017

#### 5. Gestión de contenedores

**Ver logs:**
```bash
docker-compose logs -f
```

**Detener contenedores:**
```bash
docker-compose down
```

**Detener y eliminar volúmenes (⚠️ borra datos):**
```bash
docker-compose down -v
```

**Reiniciar servicios:**
```bash
docker-compose restart
```

### Opción 3: MongoDB Atlas (Base de Datos en la Nube)

#### 1. Crear cuenta en MongoDB Atlas

1. Ve a [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Crea una cuenta gratuita
3. Crea un nuevo cluster (tier gratuito M0)
4. Crea un usuario de base de datos
5. Configura el acceso desde tu IP (o 0.0.0.0/0 para desarrollo)

#### 2. Obtener connection string

1. En MongoDB Atlas, ve a "Connect"
2. Selecciona "Connect your application"
3. Copia el connection string
4. Reemplaza `<password>` con tu contraseña de usuario

#### 3. Configurar en la aplicación

**Para desarrollo local:**
```env
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/portfolio-manager?retryWrites=true&w=majority
```

**Para Docker:**
Modificar `docker-compose.yml`:
```yaml
backend:
  environment:
    - MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/portfolio-manager?retryWrites=true&w=majority
```

#### 4. Inicializar administrador

```bash
# Desarrollo local
cd server
npm run init-admin

# Docker
docker-compose exec backend npm run init-admin
```

## 👤 Sistema de Usuarios y Autenticación

### Primer Acceso

1. Abre la aplicación en el navegador
2. Serás redirigido automáticamente a `/login`
3. Inicia sesión con:
   - **Usuario**: `admin`
   - **Contraseña**: `admin123`

### Crear Nuevos Usuarios

Solo los administradores pueden crear usuarios:

1. Inicia sesión como administrador
2. Accede a `/admin` (o haz clic en el botón "Admin" si está visible)
3. Haz clic en "➕ Crear Usuario"
4. Completa el formulario:
   - Usuario
   - Contraseña (mínimo 6 caracteres)
   - Opcional: Marcar como administrador

### Cambiar Contraseña

**Como usuario normal:**
1. Haz clic en "⚙️ Config" en el header
2. Ve a la sección "🔒 Cambiar Contraseña"
3. Ingresa:
   - Contraseña actual
   - Nueva contraseña
   - Confirmar nueva contraseña

**Como administrador (para otros usuarios):**
1. Ve a `/admin`
2. En la lista de usuarios, haz clic en "Cambiar Contraseña"
3. Ingresa la nueva contraseña

### Portfolios por Usuario

- Cada usuario tiene su propio portfolio independiente
- Los usuarios no pueden ver las operaciones de otros usuarios
- Solo los administradores pueden gestionar usuarios

## 🔐 Sistema de Administración

### Acceso al Panel de Administración

1. Inicia sesión como administrador
2. Accede directamente a: `http://localhost:5173/admin`

### Funcionalidades del Panel de Administración

#### 1. Gestión de Usuarios
- **Ver todos los usuarios**: Lista completa con información
- **Crear usuarios**: Formulario para nuevos usuarios
- **Eliminar usuarios**: Eliminación de usuarios no administradores
- **Cambiar contraseñas**: Reset de contraseñas de otros usuarios

#### 2. Configuración de API Key de Finnhub
- **Configurar API Key global**: La API key configurada aquí será usada por todos los usuarios
- Solo el administrador puede configurar la API key
- Los usuarios normales no pueden ver ni modificar la API key

#### 3. Resetear Contraseña de Administrador
- Requiere la **contraseña maestra**
- Permite cambiar la contraseña del usuario administrador principal
- Útil si otro administrador necesita resetear la contraseña del admin principal

## 🔑 Recuperación de Contraseña de Administrador

### Ruta Secreta de Recuperación

Si pierdes la contraseña del administrador, puedes recuperarla usando la ruta secreta:

**URL**: `http://localhost:5173/resetadmin`

### Proceso de Recuperación

1. Accede a `/resetadmin` en tu navegador
2. Ingresa la **Contraseña Maestra**:
   ```
   Revisa en tu fichero.env para ver la contraseña maestra
   ```
3. Ingresa la **Nueva Contraseña** (mínimo 6 caracteres)
4. Confirma la nueva contraseña
5. Haz clic en "Recuperar Contraseña"
6. Serás redirigido al login para iniciar sesión con la nueva contraseña

### Personalizar Contraseña Maestra

Para mayor seguridad, puedes cambiar la contraseña maestra:

1. Edita `server/.env`:
   ```env
   MASTER_PASSWORD=tu-contraseña-maestra-personalizada
   ```

2. Reinicia el servidor backend

### Seguridad

- La ruta `/resetadmin` es pública (no requiere autenticación)
- Solo funciona con la contraseña maestra correcta
- Solo afecta al primer usuario administrador encontrado
- ⚠️ **Importante**: Guarda la contraseña maestra en un lugar seguro

## 🔧 Configuración de API Keys

### API Key de Finnhub

La API key de Finnhub se configura globalmente por el administrador:

1. Obtén una API key gratuita en [Finnhub](https://finnhub.io/register)
2. Inicia sesión como administrador
3. Ve a `/admin`
4. Haz clic en "🔑 Configurar API Key Finnhub"
5. Ingresa tu API key
6. Haz clic en "💾 Guardar"

**Nota**: Todos los usuarios de la aplicación usarán esta API key para obtener precios de acciones.

## 📊 Uso de la Aplicación

### Agregar una Compra

1. Haz clic en "➕ Comprar"
2. Completa el formulario:
   - **Buscar Empresa**: Busca por nombre o ingresa símbolo directamente
   - **Empresa**: Nombre de la empresa
   - **Símbolo**: Ticker con exchange (ej: `AMD:FRA`, `NXT:BME`, `MSFT:NASDAQ`)
   - **Títulos**: Número de acciones
   - **Precio**: Precio por acción
   - **Moneda**: EUR, USD, GBP, CAD, JPY
   - **Tipo de Cambio**: Si la moneda no es EUR
   - **Comisiones**: Comisión pagada
   - **Fecha**: Fecha de compra
3. Opcional: Haz clic en "🔍" para consultar precio actual
4. Haz clic en "Comprar"

### Vender Acciones

1. Haz clic en "➖ Vender"
2. Selecciona una posición activa de la lista
3. El formulario se pre-llenará automáticamente con:
   - Empresa
   - Símbolo
   - Precio actual (si está disponible)
   - Acciones disponibles
4. Ajusta la cantidad de acciones a vender
5. Completa el precio de venta y otros campos
6. Haz clic en "Vender"

### Ver Posiciones Activas

Las posiciones activas se muestran en la tabla principal con:
- Empresa y símbolo
- Acciones disponibles
- Precio de compra promedio
- Precio actual (actualizado automáticamente)
- Ganancia/Pérdida en EUR
- Porcentaje de ganancia/pérdida

### Actualizar Precios

1. Haz clic en "🔄 Actualizar Precios"
2. La aplicación consultará los precios actuales de todas tus posiciones
3. Los precios se actualizarán automáticamente en la tabla

### Exportar a CSV

1. Haz clic en "📊 Exportar CSV"
2. Se generará un archivo CSV con todas las operaciones cerradas
3. El archivo incluye:
   - Fechas de compra y venta
   - Precios y comisiones
   - Tipos de cambio
   - Ganancias/pérdidas
   - Retenciones (19%)

### Ver Histórico

1. Haz clic en "📜 Histórico"
2. Verás todas las operaciones (compras y ventas) ordenadas por fecha

## 📡 API Endpoints

### Autenticación

- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/me` - Verificar sesión actual
- `POST /api/auth/change-password` - Cambiar contraseña del usuario actual
- `POST /api/auth/recover-admin-password` - Recuperar contraseña de administrador (público)

### Operaciones (Requieren autenticación)

- `GET /api/operations` - Obtener todas las operaciones del usuario actual
- `GET /api/operations/:id` - Obtener una operación específica
- `POST /api/operations` - Crear una nueva operación
- `PUT /api/operations/:id` - Actualizar una operación
- `DELETE /api/operations/:id` - Eliminar una operación
- `DELETE /api/operations` - Eliminar todas las operaciones del usuario actual

### Configuración (Requieren autenticación)

- `GET /api/config` - Obtener toda la configuración del usuario actual
- `GET /api/config/:key` - Obtener un valor de configuración específico
- `POST /api/config/:key` - Crear/actualizar configuración
- `DELETE /api/config/:key` - Eliminar configuración

### Administración (Requieren autenticación + admin)

- `GET /api/admin/users` - Obtener todos los usuarios
- `POST /api/admin/users` - Crear nuevo usuario
- `DELETE /api/admin/users/:id` - Eliminar usuario
- `PUT /api/admin/users/:id/password` - Cambiar contraseña de usuario
- `POST /api/admin/reset-admin-password` - Resetear contraseña de administrador
- `GET /api/admin/finnhub-api-key` - Obtener API key global (todos los usuarios autenticados)
- `POST /api/admin/finnhub-api-key` - Configurar API key global (solo admin)

### Yahoo Finance (Requieren autenticación)

- `GET /api/yahoo/quote/:symbol` - Obtener cotización de Yahoo Finance

### Health Check

- `GET /api/health` - Estado del servidor

## 🗂️ Estructura del Proyecto

```
Bolsa/
├── src/                          # Código fuente del frontend
│   ├── components/               # Componentes React
│   │   ├── Admin.jsx            # Panel de administración
│   │   ├── Login.jsx            # Pantalla de login
│   │   ├── ResetAdmin.jsx       # Recuperación de contraseña admin
│   │   └── ProtectedRoute.jsx   # Componente de ruta protegida
│   ├── services/                 # Servicios de API
│   │   ├── api.js               # Cliente API
│   │   └── auth.js              # Servicios de autenticación
│   ├── App.jsx                   # Componente principal
│   ├── main.jsx                  # Punto de entrada
│   └── index.css                 # Estilos globales
├── server/                       # Código fuente del backend
│   ├── config/                   # Configuración
│   │   └── database.js          # Conexión a MongoDB
│   ├── middleware/               # Middleware Express
│   │   └── auth.js              # Autenticación JWT
│   ├── models/                   # Modelos Mongoose
│   │   ├── User.js              # Modelo de usuario
│   │   ├── Operation.js         # Modelo de operación
│   │   └── Config.js            # Modelo de configuración
│   ├── routes/                   # Rutas Express
│   │   ├── auth.js              # Rutas de autenticación
│   │   ├── operations.js        # Rutas de operaciones
│   │   ├── config.js            # Rutas de configuración
│   │   ├── admin.js             # Rutas de administración
│   │   └── yahoo.js             # Rutas de Yahoo Finance
│   ├── scripts/                  # Scripts de utilidad
│   │   ├── initAdmin.js         # Inicializar usuario admin
│   │   └── migrateOperationsToUsers.js  # Migración de datos
│   ├── server.js                 # Servidor Express principal
│   ├── package.json              # Dependencias del backend
│   └── .env                      # Variables de entorno (crear)
├── public/                       # Archivos estáticos
├── docker-compose.yml            # Configuración Docker Compose
├── Dockerfile                    # Dockerfile del frontend
├── nginx.conf                    # Configuración Nginx
├── package.json                  # Dependencias del frontend
├── vite.config.js                # Configuración Vite
└── README.md                     # Esta documentación
```

## 🐳 Despliegue con Docker

### Preparación

1. Asegúrate de tener Docker y Docker Compose instalados
2. Configura `server/.env` con las variables correctas
3. Para producción, actualiza `JWT_SECRET` y `MASTER_PASSWORD`

### Construcción y Despliegue

```bash
# Construir imágenes
docker-compose build

# Levantar servicios
docker-compose up -d

# Ver logs
docker-compose logs -f

# Inicializar administrador
docker-compose exec backend npm run init-admin
```

### Variables de Entorno para Docker

Editar `docker-compose.yml` o usar archivo `.env`:

```yaml
backend:
  environment:
    - PORT=3001
    - MONGODB_URI=mongodb://mongo:27017/portfolio-manager
    - CORS_ORIGIN=http://localhost:80
    - JWT_SECRET=tu-secret-key-super-segura
    - MASTER_PASSWORD=tu-contraseña-maestra
```

### Usar MongoDB Atlas con Docker

Modificar `docker-compose.yml`:

```yaml
backend:
  environment:
    - MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/portfolio-manager?retryWrites=true&w=majority
```

Y eliminar o comentar el servicio `mongo`:

```yaml
# mongo:
#   image: mongo:7
#   ...
```

## 🔍 Troubleshooting

### Problema: No puedo iniciar sesión

**Solución:**
1. Verifica que el usuario administrador existe: `npm run init-admin` (en `server/`)
2. Verifica que el backend está corriendo
3. Revisa la consola del navegador para errores
4. Verifica que las cookies están habilitadas

### Problema: Error de conexión a MongoDB

**Solución:**
1. Verifica que MongoDB está corriendo (local) o que la URI de Atlas es correcta
2. Verifica que `MONGODB_URI` en `server/.env` es correcta
3. Para Atlas, verifica que tu IP está en la whitelist
4. Verifica que el usuario y contraseña son correctos

### Problema: Los precios no se actualizan

**Solución:**
1. Verifica que la API key de Finnhub está configurada (solo admin puede hacerlo)
2. Verifica que el símbolo es correcto (formato: `SYMBOL:EXCHANGE`)
3. Revisa la consola del navegador para errores
4. Verifica que el backend puede hacer requests externos

### Problema: Error 401 (Unauthorized)

**Solución:**
1. Tu sesión puede haber expirado, inicia sesión nuevamente
2. Verifica que el token JWT es válido
3. Limpia el localStorage y vuelve a iniciar sesión

### Problema: Docker no inicia

**Solución:**
1. Verifica que Docker Desktop está corriendo
2. Verifica que los puertos 80, 3001, 27017 no están en uso
3. Revisa los logs: `docker-compose logs`
4. Reconstruye las imágenes: `docker-compose build --no-cache`

## 📝 Scripts Disponibles

### Frontend
- `npm run dev` - Iniciar servidor de desarrollo
- `npm run build` - Construir para producción
- `npm run preview` - Previsualizar build de producción
- `npm run dev:all` - Iniciar frontend y backend juntos

### Backend
- `npm run dev` - Iniciar servidor en modo desarrollo (con watch)
- `npm start` - Iniciar servidor en modo producción
- `npm run init-admin` - Crear/actualizar usuario administrador
- `npm run migrate-operations` - Migrar operaciones antiguas a usuarios

## 🔒 Seguridad

### Recomendaciones para Producción

1. **Cambiar JWT_SECRET**: Usa una clave segura y aleatoria
2. **Cambiar MASTER_PASSWORD**: Personaliza la contraseña maestra
3. **HTTPS**: Usa certificados SSL en producción
4. **Firewall**: Restringe acceso a MongoDB
5. **Variables de entorno**: Nunca commitees `.env` al repositorio
6. **Contraseñas**: Cambia las contraseñas por defecto
7. **CORS**: Configura `CORS_ORIGIN` solo con tu dominio de producción

## 📄 Licencia

MIT

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:
1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📞 Soporte

Para problemas o preguntas:
- Revisa la sección de Troubleshooting
- Abre un issue en el repositorio
- Consulta la documentación de las APIs utilizadas

---

**Desarrollado con ❤️ para la gestión de portfolios de acciones**
