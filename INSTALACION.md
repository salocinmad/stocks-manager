# 📦 Guía de Instalación

Guía completa de configuración para Stocks Manager desde requisitos del sistema hasta el primer inicio de sesión.

---

## 📋 Tabla de Contenidos

- [Requisitos del Sistema](#requisitos-del-sistema)
- [Métodos de Instalación](#métodos-de-instalación)
- [Instalación con Docker (Recomendado)](#instalación-con-docker-recomendado)
- [Instalación Manual](#instalación-manual)
- [Configuración Inicial](#configuración-inicial)
- [Configuración](#configuración)
- [Actualización](#actualización)

---

## 🖥️ Requisitos del Sistema

### Requisitos Mínimos
- **SO**: Linux, macOS, o Windows 10/11 con WSL2
- **RAM**: 2 GB mínimo (4 GB recomendado)
- **Almacenamiento**: 5 GB de espacio libre
- **CPU**: Cualquier procesador moderno (x86_64 o ARM)
- **Red**: Conexión a Internet para datos de mercado

### Requisitos de Software
- **Docker**: Versión 20.10 o posterior
- **Docker Compose**: Versión 2.0 o posterior

> **💡 Nota**: Docker Desktop incluye Docker Compose por defecto en Windows y macOS.

---

## 🐳 Instalación con Docker (Recomendado)

Este es el método de instalación más fácil y fiable.

### Paso 1: Instalar Docker

#### Windows
1. Descargar [Docker Desktop para Windows](https://www.docker.com/products/docker-desktop/)
2. Instalar y reiniciar el ordenador
3. Habilitar WSL 2 si se solicita
4. Verificar instalación:
   ```powershell
   docker --version
   docker compose version
   ```

#### macOS
1. Descargar [Docker Desktop para Mac](https://www.docker.com/products/docker-desktop/)
2. Instalar el archivo .dmg
3. Abrir Docker Desktop
4. Verificar instalación:
   ```bash
   docker --version
   docker compose version
   ```

#### Linux (Ubuntu/Debian)
```bash
# Actualizar índice de paquetes
sudo apt-get update

# Instalar prerrequisitos
sudo apt-get install -y ca-certificates curl gnupg

# Añadir clave GPG oficial de Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Añadir repositorio
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verificar instalación
docker --version
docker compose version
```

### Paso 2: Clonar el Repositorio

```bash
git clone https://github.com/yourusername/stocks-manager.git
cd stocks-manager
```

### Paso 3: Configurar (Opcional)

Puedes personalizar la instalación creando un archivo `.env` **antes** del primer arranque:

```bash
# Opcional: Crear archivo .env personalizado
cat > .env << EOF
# API Keys (opcional - se puede configurar después desde el panel admin)
FINNHUB_API_KEY=tu_finnhub_api_key_aqui

# Puerto del servidor (opcional - por defecto 5000)
PORT=5000
EOF
```

> **⚠️ Importante**: Las credenciales de base de datos se generan automáticamente. NO las establezcas manualmente.

### Paso 4: Iniciar la Aplicación

```bash
# Construir e iniciar todos los servicios
docker compose up -d

# Verificar que todos los contenedores están funcionando
docker compose ps
```

Salida esperada:
```
NAME                          STATUS              PORTS
stocks-manager-frontend-1     Up 30 seconds       0.0.0.0:3000->80/tcp
stocks-manager-server-1       Up 30 seconds       0.0.0.0:5000->5000/tcp
stocks-manager-mariadb-1      Up 30 seconds       0.0.0.0:3306->3306/tcp
```

### Paso 5: Acceder a la Aplicación

- **Frontend**: http://localhost:3000
- **API Backend**: http://localhost:5000
- **Iniciar sesión** con:
  - Usuario: `admin`
  - Contraseña: `admin123`

> **🔒 Importante**: ¡Cambia la contraseña por defecto después del primer inicio de sesión!

✅ **¡Instalación completada!**

---

## 🛠️ Instalación Manual

Para usuarios avanzados que quieren ejecutar sin Docker.

### Prerrequisitos

- Node.js 22.x o posterior
- MariaDB 11.4 o posterior
- npm 10.x o posterior

### Configuración del Backend

```bash
cd server

# Instalar dependencias
npm install

# Crear archivo .env con credenciales de base de datos
cat > env/.env << EOF
DB_HOST=localhost
DB_NAME=portfolio_manager
DB_USER=tu_usuario_db
DB_PASS=tu_contraseña_db
JWT_SECRET=$(openssl rand -base64 32)
FINNHUB_API_KEY=tu_api_key
EOF

# Ejecutar inicialización de base de datos
node scripts/initAdmin.js

# Iniciar el servidor
npm run dev
```

### Configuración del Frontend

```bash
# Desde la raíz del proyecto
cd ..

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

### Configuración de Base de Datos

```sql
-- Crear base de datos
CREATE DATABASE portfolio_manager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Crear usuario
CREATE USER 'tu_usuario'@'localhost' IDENTIFIED BY 'tu_contraseña';
GRANT ALL PRIVILEGES ON portfolio_manager.* TO 'tu_usuario'@'localhost';
FLUSH PRIVILEGES;
```

---

## 🎯 Configuración Inicial

### 1. Iniciar Sesión

Navega a http://localhost:3000 e inicia sesión con las credenciales por defecto:
- **Usuario**: `admin`
- **Contraseña**: `admin123`

### 2. Cambiar Contraseña

1. Haz clic en el **icono de engranaje** (⚙️) en la parte superior derecha
2. Ve a **Panel de Administración**
3. Haz clic en **Cambiar Contraseña**
4. Introduce tu nueva contraseña
5. Guarda los cambios

### 3. Configurar API Keys (Opcional)

1. En el Panel de Administración, ve a **Configuración**
2. Añade tu clave API de Finnhub (gratis en https://finnhub.io/)

> **💡 Consejo**: Yahoo Finance funciona sin clave API, pero Finnhub proporciona datos en tiempo real más fiables.

### 4. Crear Tu Primera Cartera

1. Haz clic en el **menú Portfolio** (📁) junto a tu nombre de usuario
2. Selecciona **Crear Nueva Cartera**
3. Introduce un nombre (ej: "Mis Inversiones")
4. Haz clic en **Crear**

### 5. Añadir Tu Primera Acción

1. Haz clic en el botón **Comprar**
2. Busca una empresa (ej: "Apple")
3. Selecciona de los resultados
4. Introduce:
   - Acciones compradas
   - Precio de compra
   - Fecha de compra
   - Divisa
5. Haz clic en **Guardar**

✅ **¡Ya está todo listo!** Tu cartera comenzará a hacer seguimiento automáticamente.

---

## ⚙️ Configuración

### Variables de Entorno

Ubicadas en `server/env/.env` (Docker) o crear manualmente:

```bash
# Base de Datos (Auto-generado en Docker)
DB_HOST=mariadb
DB_NAME=portfolio_manager
DB_USER=usuario_generado
DB_PASS=contraseña_generada

# Seguridad (Auto-generado en Docker)
JWT_SECRET=secreto_generado
MASTER_PASSWORD=contraseña_maestra_generada

# API Keys (Opcional)
FINNHUB_API_KEY=tu_api_key

# Servidor
PORT=5000

# SMTP (Opcional - para notificaciones por correo)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_correo@gmail.com
SMTP_PASS=tu_contraseña_app
```

### Configuración del Panel de Administración

Accesible desde el **icono de engranaje** → **Panel de Administración**:

- **Clave API Finnhub**: Para datos de mercado en tiempo real
- **Nivel de Log**: Establecer en `verbose` para depuración
- **Programación Actualización de Precios**: Configurar frecuencia de actualización (por defecto: 15 min)
- **Configuración SMTP**: Configurar notificaciones por correo

---

## 🔄 Actualización

### Actualización con Docker

```bash
# Obtener último código
git pull origin main

# Reconstruir y reiniciar contenedores
docker compose down
docker compose up -d --build

# Verificar actualización
docker compose logs -f server
```

> **✅ Seguro**: Tus datos se preservan en volúmenes Docker.

### Actualización Manual

```bash
# Obtener último código
git pull origin main

# Actualizar dependencias del backend
cd server && npm install

# Actualizar dependencias del frontend
cd .. && npm install

# Reiniciar servicios
npm run dev:all
```

---

## 📂 Persistencia de Datos

### Volúmenes Docker

Los datos se almacenan en volúmenes nombrados de Docker:

- `mariadb_data` - Archivos de base de datos
- `backend_env` - Configuración de entorno
- `profile_pictures_data` - Fotos de perfil de usuario
- `db_secrets` - Credenciales de base de datos

### Backup

```bash
# Backup de base de datos
docker compose exec mariadb mariadb-dump -u root -p portfolio_manager > backup.sql

# Backup de todos los volúmenes
docker run --rm \
  -v stocks-manager_mariadb_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/mariadb_backup.tar.gz /data
```

### Restaurar

```bash
# Restaurar base de datos
docker compose exec -T mariadb mariadb -u root -p portfolio_manager < backup.sql
```

---

## 🐛 Solución de Problemas de Instalación

### Puerto Ya en Uso

```bash
# Cambiar puertos en docker-compose.yml
services:
  frontend:
    ports:
      - "8080:80"  # Cambiado desde 3000

  server:
    ports:
      - "5001:5000"  # Cambiado desde 5000
```

### El Contenedor No Arranca

```bash
# Verificar logs
docker compose logs [nombre_servicio]

# Correcciones comunes
docker compose down
docker system prune -a  # Eliminar todos los contenedores/imágenes no usados
docker compose up -d --build
```

### Error de Conexión a Base de Datos

```bash
# Verificar que MariaDB está ejecutándose
docker compose ps mariadb

# Ver logs de base de datos
docker compose logs mariadb

# Reiniciar MariaDB
docker compose restart mariadb
```

Para más problemas, ver [SOLUCION_PROBLEMAS.md](SOLUCION_PROBLEMAS.md).

---

**Siguientes Pasos**: Ver [GUIA_USUARIO.md](GUIA_USUARIO.md) para cómo usar la aplicación.
