# 🐳 Guía de Instalación - Stocks Manager

Esta guía detalla el proceso completo de instalación y configuración de Stocks Manager usando Docker.

---

## 📑 Índice

1. [Requisitos del Sistema](#-requisitos-del-sistema)
2. [Instalación con Docker](#-instalación-con-docker)
3. [Configuración](#️-configuración)
4. [Primer Inicio](#-primer-inicio)
5. [Comandos Docker Útiles](#-comandos-docker-útiles)
6. [Actualización](#-actualización)
7. [Solución de Problemas](#-solución-de-problemas)

---

## 💻 Requisitos del Sistema

### Hardware Mínimo

- **CPU**: 1 core (recomendado 2 cores)
- **RAM**: 1GB (recomendado 2GB)
- **Disco**: 5GB libres (para base de datos y backups)

### Software Requerido

- **Docker**: versión 20.10 o superior
- **Docker Compose**: versión 2.0 o superior

#### Verificar Instalación

```bash
# Verificar Docker
docker --version
# Salida esperada: Docker version 20.10.x o superior

# Verificar Docker Compose
docker compose version
# Salida esperada: Docker Compose version v2.x.x o superior
```

#### Instalar Docker

Si no tienes Docker instalado:

**Linux (Ubuntu/Debian)**:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

**Windows/Mac**:
- Descarga [Docker Desktop](https://www.docker.com/products/docker-desktop)
- Instala y reinicia el sistema

### Puertos Requeridos

Asegúrate de que estos puertos estén libres:

- **80**: Frontend + Proxy Nginx (configurable)
- **3306**: MariaDB (solo interno, no expuesto por defecto)

---

## 🚀 Instalación con Docker

### Paso 1: Clonar el Repositorio

```bash
git clone https://github.com/salocinmad/stocks-manager.git
cd stocks-manager
```

### Paso 2: Iniciar la Aplicación

```bash
docker compose up -d
```

**¡Eso es todo!** La instalación es completamente automática.

### Qué Sucede Automáticamente

En el primer arranque, Stocks Manager:

1. ✅ **Genera credenciales seguras** para MariaDB:
   - Usuario aleatorio (10 caracteres)
   - Contraseña aleatoria (32 caracteres con símbolos)
   - Contraseña root aleatoria (32 caracteres)
   - JWT_SECRET (64 caracteres hex)
   - MASTER_PASSWORD (frase memorable)

2. ✅ **Configura seguridad de MariaDB**:
   - Elimina usuarios anónimos
   - Remueve acceso remoto a root
   - Elimina base de datos de test

3. ✅ **Guarda credenciales** en volúmenes persistentes

4. ✅ **Muestra credenciales** en los logs (solo la primera vez)

### Paso 3: Ver las Credenciales Generadas

Las credenciales se muestran **una sola vez** en los logs del primer arranque.

**Ver todas las credenciales**:
```bash
docker compose logs server | grep -A 30 "CREDENCIALES DEL SISTEMA"
```

Salida esperada:
```
╔════════════════════════════════════════════════════════════════════╗
║                                                                    ║
║  🔐  CREDENCIALES DEL SISTEMA GENERADAS AUTOMÁTICAMENTE  🔐       ║
║                                                                    ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  ⚠️   GUARDA ESTAS CREDENCIALES EN UN LUGAR SEGURO   ⚠️           ║
║                                                                    ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  📦 Base de Datos MariaDB:                                         ║
║     • Usuario:           xyz1234567                                ║
║     • Contraseña:        aB3$dE...f9g0                             ║
║     • Base de Datos:     portfolio_manager                         ║
║                                                                    ║
║  🔑 Seguridad:                                                     ║
║     • JWT_SECRET:        8f3c9e2a1d5b7e4f...a8b0c2d4e6f8         ║
║     • MASTER_PASSWORD:   Freedom2-Mud9-Garnish7                   ║
║                                                                    ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  📄 Credenciales completas guardadas en:                          ║
║     • /app/env/.env (dentro del contenedor)                       ║
║     • Volumen persistente 'backend_env'                           ║
║                                                                    ║
║  💡 Para ver credenciales después:                                ║
║     docker compose exec server cat /app/env/.env                  ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

> **⚠️ CRÍTICO**: **GUARDA TODAS ESTAS CREDENCIALES INMEDIATAMENTE** en un gestor de contraseñas o lugar seguro. Las necesitarás para:
> - Conectar directamente a la base de datos (Usuario y Contraseña MariaDB)
> - Recuperar acceso de administrador (MASTER_PASSWORD)
> - Troubleshooting avanzado (JWT_SECRET)

### Paso 4: Verificar Instalación

```bash
docker compose ps
```

Deberías ver 3 contenedores en estado **"Up"**:
- `stocks-manager-mariadb`
- `stocks-manager-server`
- `stocks-manager-frontend`

### Paso 5: Acceder a la Aplicación

Abre tu navegador en:
- **Local**: `http://localhost`
- **Red local**: `http://IP_DE_TU_SERVIDOR`

Deberías ver la pantalla de login de Stocks Manager.

---

## ⚙️ Configuración

### Crear tu Primer Usuario

1. Abre la aplicación en el navegador
2. Haz clic en **"Registrarse"**
3. Introduce:
   - Usuario: `admin` (o el nombre que prefieras)
   - Contraseña: Al menos 6 caracteres
4. Inicia sesión

> **Nota**: El primer usuario creado **NO es administrador automáticamente**. Para hacerlo admin, necesitas modificar la base de datos.

### Hacer el Primer Usuario Administrador

```bash
# Acceder a MariaDB
docker compose exec mariadb sh -lc "mariadb -u \"$MYSQL_USER\" -p\"$MYSQL_PASSWORD\" \"$MYSQL_DATABASE\""

# Hacer admin al usuario (reemplaza 'admin' por tu username)
UPDATE users SET isAdmin = 1 WHERE username = 'admin';

# Salir
exit
```

Ahora ese usuario tiene acceso al **Panel de Administración**.

### Configurar API de Finnhub

1. Regístrate en [finnhub.io](https://finnhub.io/register) (gratuito)
2. Copia tu API Key
3. En Stocks Manager:
   - Accede al **Panel Admin** (icono 👤)
   - Haz clic en **"🔑 API Key Finnhub"**
   - Pega tu API Key
   - Guarda

### Configurar SMTP (Opcional)

Para recibir alertas por email:

1. Accede al **Panel Admin**
2. Haz clic en **"✉️ SMTP / Notificaciones"**
3. Configura tu servidor SMTP (ver [Guía de Administración](./ADMINISTRACION.md#configuración-smtp-notificaciones))
4. Envía un email de prueba

---

## 🎬 Primer Inicio

### Qué Esperar

Al iniciar Stocks Manager por primera vez:

1. **Migraciones Automáticas**: El servidor ejecuta migraciones de base de datos automáticamente
2. **Usuario Sistema**: Se crea un usuario especial con ID 0 (no visible, usado internamente)
3. **Portafolio Principal**: Al registrarte, se crea tu primer portafolio automáticamente
4. **Contraseña Maestra**: Se genera y se muestra en los logs (¡guárdala!)

### Ver la Contraseña Maestra

```bash
docker compose logs server | grep "CONTRASEÑA MAESTRA"
```

Guarda esta contraseña en un lugar seguro. Te permitirá recuperar acceso si olvidas la contraseña del admin.

### Primera Configuración Recomendada

1. ✅ Configura la **API Key de Finnhub**
2. ✅ Configura el **Scheduler** (Panel Admin → Scheduler)
   - Intervalo recomendado: 5-15 minutos
3. ✅ Haz un **backup** inicial (Panel Admin → Backup)
4. ✅ Configura **SMTP** si quieres notificaciones

---

## 🐳 Comandos Docker Útiles

### Inicio y Detención

```bash
# Iniciar todos los servicios
docker compose up -d

# Detener todos los servicios
docker compose down

# Reiniciar un servicio específico
docker compose restart server
docker compose restart frontend
docker compose restart mariadb
```

### Ver Logs

```bash
# Ver logs de todos los servicios (en tiempo real)
docker compose logs -f

# Ver logs de un servicio específico
docker compose logs -f server

# Ver últimas 100 líneas
docker compose logs --tail=100 server

# Buscar errores
docker compose logs server | grep ERROR
```

### Reconstrucción

Si cambias el código o dependencias:

```bash
# Reconstruir todo sin caché
docker compose build --no-cache
docker compose up -d

# Reconstruir solo el frontend
docker compose build frontend --no-cache
docker compose up -d frontend

# Reconstruir solo el backend
docker compose build server --no-cache
docker compose up -d server
```

### Acceso a Contenedores

```bash
# Shell en el servidor backend
docker compose exec server sh

# Shell en MariaDB
docker compose exec mariadb sh -lc "mariadb -u \"$MYSQL_USER\" -p\"$MYSQL_PASSWORD\" \"$MYSQL_DATABASE\""

# Shell en el contenedor de frontend (menos común)
docker compose exec frontend sh
```

### Limpieza

```bash
# Detener y eliminar todo (¡incluyendo volúmenes!)
docker compose down -v

# Eliminar imágenes antiguas
docker image prune -a

# Limpiar sistema (cuidado, elimina todo lo no usado)
docker system prune -a --volumes
```

⚠️ **Advertencia**: `docker compose down -v` **BORRARÁ LA BASE DE DATOS**. Haz backup primero.

---

## 🔄 Actualización

### Actualizar a la Última Versión

```bash
# 1. Hacer backup (CRÍTICO)
# Ver sección Backup en Guía de Administración

# 2. Descargar últimos cambios
git pull origin main

# 3. Reconstruir contenedores
docker compose down
docker compose build --no-cache
docker compose up -d

# 4. Verificar que todo funciona
docker compose logs -f
```

### Rollback (Volver a Versión Anterior)

Si algo falla:

```bash
# 1. Detener servicios
docker compose down

# 2. Volver a commit anterior
git log --oneline  # Ver commits
git checkout COMMIT_HASH

# 3. Reconstruir
docker compose build --no-cache
docker compose up -d

# 4. Restaurar backup si es necesario
# Ver Guía de Administración
```

---

## 🚨 Solución de Problemas

### Error: "Port 80 already in use"

**Causa**: Otro servicio está usando el puerto 80.

**Solución 1**: Cambiar el puerto

```yaml
# En docker-compose.yml, cambiar:
ports:
  - "8080:80"  # Usar puerto 8080 en lugar de 80
```

**Solución 2**: Detener el servicio que usa el puerto 80

**Windows**:
```powershell
# Ver qué usa el puerto 80
netstat -ano | findstr :80

# Detener proceso (reemplaza PID)
taskkill /PID numero_pid /F
```

**Linux/Mac**:
```bash
# Ver qué usa el puerto 80
sudo lsof -i :80

# Detener Apache/Nginx si está corriendo
sudo systemctl stop apache2
sudo systemctl stop nginx
```

### Error: "Cannot connect to database"

**Causa**: MariaDB no está listo o credenciales incorrectas.

**Solución**:

1. Verificar estado:
   ```bash
   docker compose ps
   ```

2. Ver logs de MariaDB:
   ```bash
   docker compose logs mariadb
   ```

3. Verificar que las credenciales en `server/.env` coinciden con las usadas al crear el volumen

4. Si cambiaste el `.env` después de crear la BD, necesitas recrear el volumen:
   ```bash
   docker compose down -v
   docker compose up -d
   ```

### Frontend Muestra Pantalla en Blanco

**Causa**: Error en el código frontend o falta de reconstrucción.

**Solución**:

1. Abrir consola del navegador (F12) y buscar errores

2. Reconstruir frontend:
   ```bash
   docker compose build frontend --no-cache
   docker compose up -d frontend
   ```

3. Limpiar caché del navegador:
   - **Chrome/Edge**: `Ctrl + Shift + R`
   - **Firefox**: `Ctrl + Shift + Delete` → Limpiar caché

### Los Precios no se Actualizan

**Causa**: Scheduler desactivado, API Key no configurada, o límite de API alcanzado.

**Solución**:

1. Verificar que el **Scheduler está activado** (Panel Admin)
2. Verificar que la **API Key de Finnhub** está configurada
3. Comprobar límites de API:
   - Finnhub Free: 60 llamadas/minuto
   - Si alcanzas el límite, aumenta el intervalo del scheduler
4. Ver logs del scheduler:
   ```bash
   docker compose logs -f server | grep scheduler
   ```

### El Cierre Diario no Funciona

**Causa**: Faltan datos, símbolos incorrectos, o error en Yahoo Finance.

**Solución**:

1. Ejecutar manualmente desde Panel Admin
2. Ver error específico en logs:
   ```bash
   docker compose logs server | grep "daily close"
   ```
3. Verificar que los símbolos de Yahoo son correctos (ej: `AAPL`, `MSFT`, `SAN.MC`)

### Error: "ENOSPC: no space left on device"

**Causa**: Disco lleno.

**Solución**:

1. Verificar espacio:
   ```bash
   df -h
   ```

2. Limpiar Docker:
   ```bash
   docker system prune -a --volumes
   ```

3. Eliminar backups antiguos

4. Aumentar espacio en disco si es necesario

---

## 🌐 Configuración Avanzada

### Usar HTTPS (Producción)

Para producción, usa HTTPS con Let's Encrypt:

#### Con Nginx y Certbot

1. **Instalar Certbot**:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   ```

2. **Obtener certificado**:
   ```bash
   sudo certbot --nginx -d tu-dominio.com
   ```

3. **Configurar auto-renovación**:
   ```bash
   sudo systemctl enable certbot.timer
   ```

#### Con Traefik (Alternativa)

Si prefieres usar Traefik como proxy inverso, consulta la [documentación oficial de Traefik](https://doc.traefik.io/traefik/).

### Exponer en Red Local

Por defecto, Stocks Manager solo es accesible desde `localhost`.

Para permitir acceso desde otros dispositivos en tu red:

1. Obtén la IP de tu servidor:
   ```bash
   # Linux/Mac
   ip addr show
   
   # Windows
   ipconfig
   ```

2. Abre el puerto en el firewall:
   **Linux**:
   ```bash
   sudo ufw allow 80/tcp
   ```
   
   **Windows**: Firewall → Reglas de entrada → Nueva regla → Puerto 80

3. Accede desde otro dispositivo: `http://IP_SERVIDOR`

### Backup Automático con Cron

**Linux/Mac**:

```bash
# Editar crontab
crontab -e

# Añadir línea (backup diario a las 3 AM)
0 3 * * * cd /ruta/a/stocks-manager && docker compose exec -T mariadb sh -lc 'mariadb-dump -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' > /backups/stocks_$(date +\%Y\%m\%d).sql
```

**Windows (Programador de Tareas)**:

Crea `backup.bat`:

```bat
@echo off
cd C:\ruta\a\stocks-manager
docker compose exec -T mariadb sh -lc "mariadb-dump -u \"$MYSQL_USER\" -p\"$MYSQL_PASSWORD\" \"$MYSQL_DATABASE\"" > C:\backups\stocks_%date:~-4,4%%date:~-10,2%%date:~-7,2%.sql
```

Programa en Programador de Tareas → Crear Tarea Básica.

---

## 📋 Checklist Post-Instalación

- [ ] Aplicación accesible en el navegador
- [ ] Primer usuario creado y con permisos admin
- [ ] API Key de Finnhub configurada
- [ ] Scheduler activado y funcionando
- [ ] Backup inicial realizado
- [ ] Contraseña maestra guardada en lugar seguro
- [ ] SMTP configurado (opcional)
- [ ] Puerto 80 accesible desde la red (si se requiere)

---

**¿Problemas?** Consulta la [Guía de Administración](./ADMINISTRACION.md) o abre un issue en [GitHub](https://github.com/salocinmad/stocks-manager/issues).

**¡Instalación completa!** 🚀
