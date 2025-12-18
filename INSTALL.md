# Guía de Instalación

Esta guía te ayudará a instalar y ejecutar **Stocks Manager** en tu propio servidor o máquina local. El método recomendado para producción y facilidad de uso es mediante **Docker**.

---

## 🐋 Método Recomendado: Docker

Docker te permite levantar toda la aplicación (Base de datos, Backend y Frontend) con un solo comando, sin preocuparte de instalar dependencias manualmente.

### Requisitos previos
- Tener instalado **Docker** y **Docker Compose**.

### Pasos de Instalación

1.  **Clonar el repositorio:**
    Descarga el código fuente en tu máquina.
    ```bash
    git clone https://github.com/salocinmad/stocks-manager.git
    cd stocks-manager
    ```

2.  **Configurar variables de entorno (Opcional):**
    El proyecto incluye valores por defecto seguros para un inicio rápido. Si necesitas cambiar puertos o credenciales, edita el archivo `.env` o el `docker-compose.yml`.

3.  **Construir y Arrancar:**
    Ejecuta el siguiente comando para construir las imágenes y levantar los contenedores en segundo plano:
    ```bash
    docker compose up -d --build
    ```
    *Nota: La primera vez puede tardar unos minutos en descargar y compilar todo.*

4.  **Acceder a la aplicación:**
    Una vez termine, abre tu navegador y visita:
    - **App**: `http://localhost:5173` (o el puerto que hayas configurado).
    - **Usuario Admin por defecto**: El sistema te pedirá crear un administrador o iniciará con credenciales si están configuradas (revisar logs si aplica). Por defecto en instalaciones nuevas, deberás registrar tu primer usuario.

### Comandos Útiles de Docker

- **Ver logs en tiempo real:**
  ```bash
  docker compose logs -f
  ```
- **Parar la aplicación:**
  ```bash
  docker compose down
  ```
- **Reconstruir desde cero (si algo falla):**
  ```bash
  docker compose build --no-cache
  docker compose up -d
  ```

---

## 💻 Método para Desarrolladores (Instalación Local)

Si eres desarrollador y quieres modificar el código, puede ser útil ejecutar los servicios individualmente en tu máquina.

### Requisitos previos
- **Node.js** (v18 o superior).
- **MariaDB/MySQL** instalado y corriendo localmente.

### 1. Configurar Base de Datos
Asegúrate de tener una instancia de MariaDB corriendo. Crea una base de datos vacía (ej. `portfolio_manager`) y un usuario con permisos.
Edita el archivo `.env` en la carpeta `server/` con tus credenciales locales.

### 2. Backend (API)

```bash
cd server
npm install    # Instalar dependencias
npm start      # Iniciar servidor
```
El servidor escuchará por defecto en `http://localhost:3000`.

### 3. Frontend (Web)

En otra terminal:
```bash
cd frontend
npm install    # Instalar dependencias
npm run dev    # Iniciar servidor de desarrollo
```
La web estará disponible en `http://localhost:5173`.

---

## 🔄 Actualización

Cuando haya una nueva versión de Stocks Manager:

1.  Descarga los últimos cambios:
    ```bash
    git pull origin main
    ```
2.  Reconstruye los contenedores:
    ```bash
    docker compose down
    docker compose up -d --build
    ```
