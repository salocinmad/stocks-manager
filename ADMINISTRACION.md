# 🛡️ Guía de Administración - Stocks Manager

Esta guía cubre todas las tareas de administración, configuración del sistema, mantenimiento y recuperación para Stocks Manager.

---

## 📑 Índice

1. [Panel de Administración](#-panel-de-administración)
2. [Gestión de Usuarios](#-gestión-de-usuarios)
3. [Configuración del Sistema](#️-configuración-del-sistema)
4. [Mantenimiento](#-mantenimiento)
5. [Backup y Restauración](#-backup-y-restauración)
6. [Recuperación de Contraseñas](#-recuperación-de-contraseñas)

---

## 🎛️ Panel de Administración

### Acceder al Panel Admin

1. Inicia sesión con una cuenta de **administrador**
2. Haz clic en el icono **"👤 Admin"** en la barra superior
3. Se abrirá el panel de administración

> **Nota**: Solo los usuarios con permisos de administrador pueden acceder al panel.

### Navegación

El panel está organizado en 3 secciones principales:
- **👤 Gestión de Usuarios**: Crear, editar y eliminar usuarios
- **⚙️ Configuración**: API Keys, SMTP, Scheduler, Logging
- **🔧 Mantenimiento**: Backup, cierre diario, reportes, alertas

---

## 👥 Gestión de Usuarios

### Crear un Nuevo Usuario

1. En el panel Admin, sección **"Gestión de Usuarios"**
2. Haz clic en **"➕ Crear Usuario"**
3. Rellena el formulario:
   - **Usuario**: Nombre de usuario (único, en minúsculas)
   - **Contraseña**: Mínimo 6 caracteres
   - **Administrador**: Marca si quieres que sea admin
4. Haz clic en **"Crear"**

El nuevo usuario podrá iniciar sesión inmediatamente.

### Cambiar Contraseña de un Usuario

1. En la lista de usuarios del panel Admin
2. Haz clic en **"Cambiar Contraseña"** junto al usuario
3. Introduce la nueva contraseña
4. Confirma el cambio

> **Importante**: El usuario no recibirá notificación del cambio. Debes comunicárselo manualmente.

### Eliminar un Usuario

1. En la lista de usuarios del panel Admin
2. Haz clic en **"Eliminar"** junto al usuario
3. Confirma la eliminación

⚠️ **Advertencia**: Esto eliminará:
- El usuario
- Todos sus portafolios
- Todas sus operaciones
- Todo su historial

Esta acción **no se puede deshacer**.

---

## ⚙️ Configuración del Sistema

### API Key de Finnhub

Finnhub proporciona datos de precios en tiempo real y búsqueda de empresas.

#### Configurar la API Key

1. **Obtener API Key gratuita**:
   - Visita [finnhub.io/register](https://finnhub.io/register)
   - Regístrate con tu email
   - Copia tu API Key

2. **Configurar en Stocks Manager**:
   - Panel Admin → **"🔑 API Key Finnhub"**
   - Pega tu API Key
   - Haz clic en **"💾 Guardar"**

#### Límites de la API Gratuita

- **60 llamadas/minuto**
- **30 símbolos en watchlist**
- Datos con delay de ~1 minuto

Para planes premium, consulta [finnhub.io/pricing](https://finnhub.io/pricing).

### Configuración SMTP (Notificaciones)

Configura un servidor SMTP para enviar notificaciones por email (alertas de precio, etc.).

#### Configurar SMTP

1. Panel Admin → **"✉️ SMTP / Notificaciones"**
2. Rellena los campos:
   - **Host**: Servidor SMTP (ej: `smtp.gmail.com`)
   - **Puerto**: Puerto SMTP (ej: `587` para TLS)
   - **Usuario**: Tu email completo
   - **Password**: Contraseña de la app (ver nota Gmail)
   - **Asunto**: Asunto por defecto de los emails
   - **Destinatarios**: Emails separados por comas
3. Haz clic en **"💾 Guardar SMTP"**
4. Prueba con **"✉️ Enviar prueba"**

#### Configuración para Gmail

Si usas Gmail:
1. Activa la **verificación en 2 pasos**
2. Genera una **contraseña de aplicación**: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Usa esa contraseña en Stocks Manager

Configuración:
- **Host**: `smtp.gmail.com`
- **Puerto**: `587`
- **Usuario**: `tu-email@gmail.com`
- **Password**: La contraseña de aplicación (16 caracteres)

### Scheduler de Precios

El scheduler actualiza los precios automáticamente cada cierto intervalo.

#### Configurar el Scheduler

1. Panel Admin → **"⚙️ Scheduler"**
2. Configuración:
   - **Activado**: Marca/desmarca para activar/pausar
   - **Intervalo (minutos)**: Frecuencia de actualización (mínimo 1, recomendado 5-15)
3. Haz clic en **"💾 Guardar"**

#### Ejecución Manual

Haz clic en **"▶ Ejecutar ahora"** para forzar una actualización inmediata de precios.

#### Última Ejecución

El panel muestra cuándo fue la última actualización de precios.

### Nivel de Logging

Controla el nivel de detalle de los logs del servidor.

- **Logging Minimal**: Solo errores críticos
- **Logging Detallado**: Todos los eventos (útil para debugging)

Para cambiar:
1. Panel Admin → **"❌ Logging Minimal"** o **"✅ Logging Detallado"**
2. El cambio es instantáneo

> **Recomendación**: Usa logging detallado solo durante debugging. En producción usa minimal.

---

## 🔧 Mantenimiento

### Cierre Diario

El cierre diario es un **snapshot** de todas las posiciones al final del día.

#### ¿Qué hace?

1. Captura el precio de cierre de todas las posiciones activas
2. Guarda un snapshot del estado de cada portafolio
3. Calcula métricas diarias (PnL, valor total, etc.)
4. Permite construir gráficos históricos

#### Ejecución Automática

Por defecto, se ejecuta **automáticamente a las 01:00 AM** (hora del servidor) todos los días.

#### Ejecución Manual

Panel Admin → **"📅 Ejecutar Cierre Diario"**

Útil si:
- Quieres forzar un cierre en otro horario
- El cierre automático falló
- Has añadido operaciones antiguas y quieres actualizar el histórico

### Forzar Recálculo del Último Día

Si has corregido operaciones y quieres que el gráfico de hoy refleje los cambios:

1. Panel Admin → **"♻️ Forzar PnL último día"**
2. Confirma la acción

Esto **sobrescribe** el snapshot del día anterior con los precios actuales.

### Rearmar Alertas

Las alertas de precio objetivo se desactivan automáticamente cuando se disparan.

Para reactivarlas todas:

1. Panel Admin → **"🔁 Rearmar Alertas"**
2. Confirma la acción

Todas las alertas de precio objetivo volverán a estar activas.

### Generar Reportes

Los reportes (diarios, mensuales, anuales) se generan automáticamente tras el cierre diario.

Para forzar generación manual:

1. Panel Admin → **"📊 Generar Reportes"**
2. Confirma la acción

Se generarán reportes para **todos los portafolios** de todos los usuarios.

### Sobrescribir Historial (Emergencia)

⚠️ **Función de emergencia**: Sobrescribe datos históricos con datos frescos de Yahoo Finance.

Úsala solo si:
- Los datos históricos están corruptos
- Quieres actualizar velas OHLC con datos correctos
- Has migrado de otro sistema y los precios no coinciden

#### Cómo usarlo

1. Panel Admin → **"🔄 Sobrescribir Historial (Emergencia)"**
2. Introduce el número de días a sobrescribir (ej: 30)
3. **Confirma la advertencia** (⚠️ esto borrará datos manuales)
4. Espera a que termine (puede tardar varios minutos)

El sistema descargará datos de Yahoo Finance y actualizará las tablas `DailyPrice` y `GlobalStockPrice`.

---

## 💾 Backup y Restauración

### ¿Por qué hacer Backups?

Los backups son **críticos** para:
- Proteger tus datos contra fallos de hardware
- Recuperarte de errores humanos
- Migrar a otro servidor
- Mantener un historial de tu cartera

### Exportar Backup

1. Panel Admin → **"💾 Backup y Restauración"**
2. Selecciona el formato:
   - **JSON (Recomendado)**: Portátil, fácil de editar, compatible con futuras versiones
   - **SQL**: Compatible con herramientas MySQL/MariaDB clásicas
3. Haz clic en **"Descargar Backup"**
4. El archivo se descarga automáticamente con fecha: `backup_YYYY-MM-DD.json`

### Restaurar Backup

⚠️ **ADVERTENCIA CRÍTICA**: Restaurar un backup **BORRA TODOS LOS DATOS ACTUALES** y los reemplaza con los del backup.

#### Pasos

1. Panel Admin → **"💾 Backup y Restauración"**
2. Sección **"⬆️ Restaurar Backup"**
3. Haz clic en **"Seleccionar archivo..."**
4. Elige tu archivo `.json` o `.sql`
5. **Confirma la advertencia** (⚠️ se borrarán todos los datos)
6. Espera a que termine (puede tardar varios minutos)
7. **Reinicia sesión** para ver los datos restaurados

### Programar Backups Automáticos

Stocks Manager no incluye backups automáticos por defecto.

**Recomendación**: Configura un cronjob o tarea programada en tu sistema:

#### Linux/Mac (cronjob)

```bash
# Editar crontab
crontab -e

# Añadir línea (backup diario a las 3 AM)
0 3 * * * cd /ruta/a/stocks-manager && docker compose exec mariadb sh -lc 'mariadb-dump -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' > /backups/stocks_$(date +\%Y\%m\%d).sql
```

#### Windows (Programador de Tareas)

Crea un script `.bat`:

```bat
@echo off
cd C:\ruta\a\stocks-manager
docker compose exec mariadb sh -lc "mariadb-dump -u \"$MYSQL_USER\" -p\"$MYSQL_PASSWORD\" \"$MYSQL_DATABASE\"" > C:\backups\stocks_%date:~-4,4%%date:~-10,2%%date:~-7,2%.sql
```

Programa la tarea en el Programador de Tareas de Windows.

---

## 🔑 Recuperación de Contraseñas

### Restablecer Contraseña de Administrador

Si has perdido acceso a la cuenta admin, hay **3 métodos** de recuperación.

#### Método 1: Contraseña Maestra (Recomendado) ⭐

La contraseña maestra se genera automáticamente al iniciar el servidor por primera vez.

1. **Localizar la Contraseña Maestra**:
   - **Opción A**: Busca en los logs del servidor:
     ```bash
     docker compose logs server | grep "CONTRASEÑA MAESTRA"
     ```
   - **Opción B**: Busca en el archivo `.env` la variable `MASTER_PASSWORD`

2. **Acceder al formulario de reset**:
   - Navega a `http://tu-servidor/resetadmin`
   - Introduce la contraseña maestra
   - Define la nueva contraseña para admin
   - Confirma el cambio

#### Método 2: Desde el Panel Admin

Si tienes acceso a otra cuenta admin:

1. Accede al Panel Admin con esa cuenta
2. Sección **"Gestión de Usuarios"**
3. Haz clic en **"🔑 Resetear Contraseña Admin"**
4. Introduce la contraseña maestra
5. Define la nueva contraseña

#### Método 3: Modificación DirectaEn Base de Datos

Si no tienes la contraseña maestra ni acceso a otro admin:

1. **Accede al contenedor de MariaDB**:
   ```bash
   docker compose exec mariadb sh -lc "mariadb -u \"$MYSQL_USER\" -p\"$MYSQL_PASSWORD\" \"$MYSQL_DATABASE\""
   ```

2. **Genera un hash bcrypt** para una contraseña temporal:
   - Usa [bcrypt-generator.com](https://bcrypt-generator.com/)
   - Genera hash para `admin123` (o tu contraseña temporal)
   - Copia el hash

3. **Actualiza la contraseña**:
   ```sql
   UPDATE users SET password = '$2b$10$TU_HASH_AQUI' WHERE username = 'admin';
   ```

4. **Inicia sesión** con `admin` / `admin123`
5. **Cambia la contraseña inmediatamente** desde el perfil

---

## 📊 Monitorización

### Ver Logs del Servidor

```bash
# Ver logs en tiempo real
docker compose logs -f server

# Ver últimas 100 líneas
docker compose logs --tail=100 server

# Buscar errores
docker compose logs server | grep ERROR
```

### Estado de los Servicios

```bash
# Ver estado de todos los contenedores
docker compose ps

# Ver uso de recursos
docker stats
```

### Verificar Salud de la Base de Datos

```bash
# Entrar en MariaDB
docker compose exec mariadb sh -lc "mariadb -u \"$MYSQL_USER\" -p\"$MYSQL_PASSWORD\" \"$MYSQL_DATABASE\""

# Verificar tablas
SHOW TABLES;

# Verificar usuarios
SELECT id, username, isAdmin FROM users;

# Salir
exit
```

---

## 🚨 Solución de Problemas

### El Scheduler no Actualiza Precios

1. Verifica que está **activado** en Panel Admin → Scheduler
2. Comprueba que la **API Key de Finnhub** está configurada
3. Revisa los **logs** del servidor:
   ```bash
   docker compose logs -f server | grep scheduler
   ```

### Las Notificaciones SMTP no Funcionan

1. Verifica la **configuración SMTP** en el panel
2. Haz clic en **"Enviar prueba"** y revisa el error
3. Comprueba:
   - Host y puerto correctos
   - Usuario y contraseña correctos
   - Puerto correcto (587 para TLS, 465 para SSL)
4. Si usas Gmail, verifica que tienes una **contraseña de aplicación**

### El Cierre Diario Falla

1. Revisa los **logs** del servidor
2. Comprueba que hay conexión a **Yahoo Finance**
3. Verifica que los **símbolos** de las posiciones son correctos
4. Ejecuta manualmente desde el Panel Admin para ver el error

### La Restauración de Backup Falla

1. Verifica que el **formato** del archivo es correcto (.json o .sql)
2. Comprueba que el archivo **no está corrupto**
3. Asegúrate de tener **suficiente espacio** en disco
4. Revisa los **logs del servidor** para ver el error exacto

---

## 📋 Checklist de Mantenimiento

### Diario
- [ ] Verificar que el cierre diario se ejecutó correctamente
- [ ] Revisar alertas activas

### Semanal
- [ ] Comprobar logs de errores
- [ ] Verificar uso de disco
- [ ] Revisar estado del scheduler

### Mensual
- [ ] **Hacer backup** de la base de datos
- [ ] Verificar que los reportes mensuales se generan
- [ ] Revisar usuarios activos

### Trimestral
- [ ] Actualizar dependencias (si hay actualizaciones de seguridad)
- [ ] Revisar configuración de SMTP
- [ ] Verificar límites de API (Finnhub)

---

## 🔐 Seguridad

### Mejores Prácticas

✅ **Hazlo**:
- Cambia el `JWT_SECRET` y `MASTER_PASSWORD` en producción
- Usa contraseñas fuertes (mínimo 12 caracteres)
- Haz backups mensuales y guárdalos en lugar seguro
- Limita el acceso admin solo a usuarios de confianza
- Usa HTTPS en producción (con nginx + Let's Encrypt)

❌ **Evita**:
- Dejar las contraseñas por defecto
- Compartir la contraseña maestra públicamente
- Exponer el puerto de MariaDB (3306) públicamente
- Dar permisos admin a todos los usuarios

---

**¿Más dudas?** Consulta la [Guía de Instalación](./INSTALACION.md) o abre un issue en GitHub.
