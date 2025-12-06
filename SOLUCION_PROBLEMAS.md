# 🔧 Solución de Problemas

Problemas comunes y soluciones, incluyendo reseteo de contraseña de administrador.

---

## 📋 Tabla de Contenidos

- [Resetear Contraseña de Administrador](#resetear-contraseña-de-administrador)
- [Problemas de Inicio de Sesión](#problemas-de-inicio-de-sesión)
- [Problemas con Docker](#problemas-con-docker)
- [Problemas de Actualización de Precios](#problemas-de-actualización-de-precios)
- [Problemas de Base de Datos](#problemas-de-base-de-datos)
- [Errores Comunes](#errores-comunes)

---

## 🔐 Resetear Contraseña de Administrador

### Método 1: Usando el Script de Reset (Recomendado)

La forma más fácil de resetear la contraseña de admin:

```bash
# Resetear contraseña admin a un nuevo valor
docker compose exec server node scripts/resetAdminPassword.js NuevaContraseña123

# O resetear para un usuario específico
docker compose exec server node scripts/resetAdminPassword.js NuevaContraseña123 admin
```

**Salida:**
```
✅ Contraseña actualizada correctamente
   Usuario: admin
   Es administrador: Sí
   Nueva contraseña: NuevaContraseña123

⚠️  IMPORTANTE: Guarda esta contraseña en un lugar seguro
```

### Método 2: Usando Contraseña Maestra

Si no puedes acceder al servidor:

1. Localiza la **Contraseña Maestra** en tu entorno:
   ```bash
   # Ver todos los secretos
   docker compose exec server cat /run/secrets/db_credentials
   
   # O ver env del servidor
   docker compose exec server cat env/.env | grep MASTER
   ```

2. Usa la contraseña maestra para iniciar sesión:
   - Usuario: `admin`
   - Contraseña: [MASTER_PASSWORD del paso 1]

3. Una vez dentro, cambia tu contraseña en **Panel Admin** → **Cambiar Contraseña**

### Método 3: Acceso Directo a Base de Datos

Para usuarios avanzados cuando otros métodos fallan:

```bash
# 1. Acceder al contenedor MariaDB
docker compose exec mariadb bash

# 2. Iniciar sesión en MariaDB (usa credenciales de /run/secrets/db_credentials)
mariadb -u <DB_USER> -p<DB_PASS> portfolio_manager

# 3. Generar un nuevo hash de contraseña
# Usa este comando Node.js en tu máquina local:
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('TuNuevaContraseña', 10));"

# 4. Actualizar la contraseña en la base de datos
UPDATE Users SET password='<hash del paso 3>' WHERE username='admin';

# 5. Salir de MariaDB
EXIT;
```

### Método 4: Reset Completo (Opción Nuclear)

⚠️ **ADVERTENCIA**: ¡Esto elimina TODOS los datos!

```bash
# Detener contenedores
docker compose down

# Eliminar volúmenes
docker volume rm stocks-manager_mariadb_data
docker volume rm stocks-manager_backend_env

# Iniciar de nuevo
docker compose up -d

# Credenciales por defecto: admin / admin123
```

---

## 🚪 Problemas de Inicio de Sesión

### Error "Credenciales no válidas"

**Síntomas:** El inicio de sesión falla con "Usuario o contraseña incorrectos"

**Soluciones:**

1. **Verificar mayúsculas/minúsculas del usuario**: El nombre de usuario debe estar en minúsculas (`admin`, no `Admin`)
2. **Resetear contraseña**: Usa el Método 1 de [Resetear Contraseña de Administrador](#resetear-contraseña-de-administrador)
3. **Verificar contraseña por defecto**: Si es primera instalación, prueba con `admin123`
4. **Verificar bloqueo de mayúsculas**: Las contraseñas son sensibles a mayúsculas
5. **Limpiar caché del navegador**: Prueba en modo incógnito/privado

### "Sesión expirada" en Cada Inicio de Sesión

**Causa:** Problemas con tokens JWT

**Solución:**
```bash
# Reiniciar el servidor para regenerar tokens
docker compose restart server
```

### No se Puede Acceder a la Página de Login

**Síntomas:** http://localhost:3000 no carga

**Soluciones:**

1. **Verificar si el frontend está ejecutándose:**
   ```bash
   docker compose ps frontend
   ```

2. **Ver logs del frontend:**
   ```bash
   docker compose logs frontend
   ```

3. **Reiniciar frontend:**
   ```bash
   docker compose restart frontend
   ```

4. **Verificar conflictos de puerto:**
   ```bash
   # Windows
   netstat -ano | findstr :3000
   
   # Linux/Mac
   lsof -i :3000
   ```

---

## 🐳 Problemas con Docker

### Los Contenedores No Arrancan

```bash
# Verificar estado del contenedor
docker compose ps

# Ver logs para servicio específico
docker compose logs mariadb
docker compose logs server
docker compose logs frontend

# Solución común: Reconstruir
docker compose down
docker system prune -a
docker compose up -d --build
```

### MariaDB No Arranca

```bash
# Ver logs de MariaDB
docker compose logs mariadb

# Reiniciar MariaDB
docker compose restart mariadb

# Si persiste: Eliminar datos y reiniciar
docker compose down
docker volume rm stocks-manager_mariadb_data
docker compose up -d
```

---

## 💹 Problemas de Actualización de Precios

### Los Precios No se Actualizan

**Soluciones:**

1. **Actualización manual:**
   - Clic en botón "🔄 Actualizar Precios"

2. **Reiniciar servidor:**
   ```bash
   docker compose restart server
   ```

3. **Verificar API keys:**
   - Panel Admin → Configuración
   - Añadir clave API de Finnhub

### Error "401 Unauthorized" de Yahoo Finance

**Soluciones:**

1. **Usar Finnhub como primario:**
   - Añadir clave API de Finnhub en Panel Admin

2. **Esperar y reintentar:**
   - Yahoo puede bloquear temporalmente
   - Generalmente se resuelve en minutos/horas

### Datos Históricos Faltantes

**Soluciones:**

1. **Redescargar datos históricos:**
   - Panel Admin → **Sobrescribir Datos Históricos**
   - Hacer clic y esperar (puede tardar varios minutos)

---

## 🗄️ Problemas de Base de Datos

### Conexión Rechazada

```bash
# Verificar si MariaDB está ejecutándose
docker compose ps mariadb

# Verificar credenciales
docker compose exec server cat /run/secrets/db_credentials

# Probar conexión
docker compose exec server nc -zv mariadb 3306
```

### Errores de Clave Duplicada

```bash
# Ejecutar script de normalización de índices
docker compose exec server node scripts/normalize-indexes.js --apply
```

---

## ❌ Errores Comunes

### "Cannot read properties of undefined"

**Soluciones:**

1. Limpiar caché del navegador y recargar
2. Verificar consola del navegador (F12)
3. Reiniciar frontend:
   ```bash
   docker compose restart frontend
   ```

### Errores de "CORS Policy"

**Solución:**
```bash
# Añadir CORS_ORIGIN en docker-compose.yml
services:
  server:
    environment:
      - CORS_ORIGIN=http://localhost:3000

# Reiniciar
docker compose up -d
```

---

## 🔍 Consejos de Depuración

### Habilitar Logging Detallado

```bash
# En Panel Admin → Configuración → Nivel de Log → Verbose

# Ver logs detallados
docker compose logs -f server
```

### Verificar Salud del Servidor

```bash
# Endpoint de health check
curl http://localhost:5000/api/health

# Respuesta esperada:
# {"status":"ok","message":"Server is running"}
```

### Inspeccionar Base de Datos

```bash
# Acceder a CLI de MariaDB
docker compose exec mariadb mariadb -u <user> -p portfolio_manager

# Consultas útiles:
SELECT COUNT(*) FROM Operations;
SELECT COUNT(*) FROM DailyPrices;
SELECT * FROM Users;
SELECT * FROM Portfolios;
```

---

## 📞 Obtener Ayuda

Si tu problema no está cubierto aquí:

1. **Revisar logs del servidor:**
   ```bash
   docker compose logs server | tail -100
   ```

2. **Revisar consola del navegador:**
   - F12 → Pestaña Console
   - Buscar errores en rojo

3. **Crear issue en GitHub:**
   - Incluir mensajes de error
   - Incluir pasos para reproducir
   - Incluir información del sistema (SO, versión de Docker)

4. **Revisar documentación:**
   - [GUIA_USUARIO.md](GUIA_USUARIO.md) - Uso de características
   - [DOCUMENTACION_TECNICA.md](DOCUMENTACION_TECNICA.md) - Detalles de arquitectura
   - [INSTALACION.md](INSTALACION.md) - Instrucciones de configuración

---

**¿Aún tienes problemas?** Crea un issue en GitHub con:
- Mensajes de error
- Pasos para reproducir
- Logs del servidor (`docker compose logs`)
- Información del sistema
