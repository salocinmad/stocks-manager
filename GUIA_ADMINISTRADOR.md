# 🛠️ Guía de Administrador - Stocks Manager

Versión 2.0 | Última actualización: Diciembre 2025

---

## 📑 Índice

1. [Instalación y Despliegue](#-instalación-y-despliegue)
2. [Panel de Administración](#-panel-de-administración)
3. [Gestión de Usuarios](#-gestión-de-usuarios)
4. [Configuración del Sistema](#-configuración-del-sistema)
5. [Claves API](#-claves-api)
6. [Configuración SMTP](#-configuración-smtp)
7. [Configuración de IA](#-configuración-de-ia)
8. [Sincronización de Mercado](#-sincronización-de-mercado)
9. [Backup y Restauración](#-backup-y-restauración)
10. [Monitorización](#-monitorización)

---

## 🐳 Instalación y Despliegue

### Requisitos

- Docker y Docker Compose
- 2GB RAM mínimo
- 10GB espacio en disco

### Despliegue con Docker Compose

```bash
# Clonar repositorio
git clone <tu-repo> stocks-manager
cd stocks-manager

# Crear archivo de variables de entorno
cp server/env.example .env

# Editar variables (ver sección siguiente)
nano .env

# Desplegar
docker compose up -d --build
```

### Variables de Entorno (.env)

```bash
# Base de datos
DB_HOST=db
DB_PORT=5432
DB_NAME=stocks_manager
DB_USER=admin
DB_PASSWORD=tu_password_seguro

# JWT
JWT_SECRET=clave_secreta_muy_larga_y_segura

# APIs (opcional al inicio)
FINNHUB_API_KEY=
GOOGLE_API_KEY=

# SMTP (para emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu@email.com
SMTP_PASSWORD=app_password
SMTP_FROM=tu@email.com
```

### Acceso Inicial

1. Accede a `http://tu-servidor:3000`
2. Regístrate con el primer usuario (se convierte en admin automáticamente)
3. Ve al panel de administración

---

## 🎛️ Panel de Administración

### Acceso

1. Inicia sesión con una cuenta de administrador
2. Haz clic en **"Admin"** en el menú lateral

### Pestañas Disponibles

| Pestaña | Función |
|---------|---------|
| **General** | URL pública y configuración básica |
| **IA** | Configuración de Gemini y prompts |
| **Mercado** | Sincronización de datos históricos |
| **Usuarios** | Gestión de cuentas |
| **Claves API** | Configuración de Finnhub |
| **SMTP** | Configuración de email |
| **Backup** | Exportar/importar datos |
| **Estadísticas** | Métricas del sistema |

---

## 👥 Gestión de Usuarios

### Listado de Usuarios

En la pestaña **Usuarios** verás:

| Columna | Descripción |
|---------|-------------|
| Usuario | Nombre y email |
| Rol | Admin o Usuario |
| Estado | Activo o Bloqueado |
| 2FA | Estado de autenticación 2FA |
| Registrado | Fecha de registro |
| Acciones | Botones de gestión |

### Acciones sobre Usuarios

| Acción | Icono | Descripción |
|--------|-------|-------------|
| Cambiar rol | 👤 | Alternar entre Admin y Usuario |
| Bloquear/Desbloquear | 🔒 | Impedir/permitir acceso |
| Cambiar contraseña | 🔑 | Establecer nueva contraseña |
| Eliminar | 🗑️ | Borrar usuario (irreversible) |
| Reset 2FA | 🔐 | Desactivar 2FA del usuario |
| Reset modo seguridad | 🛡️ | Cambiar a modo estándar |

### Bloquear Usuario

Cuando bloqueas un usuario:
- No puede iniciar sesión
- Sus datos se mantienen
- Puede ser desbloqueado después

### Resetear 2FA

Usa esta opción si un usuario:
- Perdió acceso a su app autenticadora
- Perdió los códigos de respaldo
- No puede entrar a su cuenta

Tras resetear, el usuario podrá configurar 2FA de nuevo.

---

## ⚙️ Configuración del Sistema

### Pestaña General

| Campo | Descripción |
|-------|-------------|
| **URL Pública** | URL donde está desplegada la app (ej: `https://stocks.tudominio.com`). Se usa en notificaciones por email. |

---

## 🔑 Claves API

### Finnhub

1. Obtén una API key en [finnhub.io](https://finnhub.io)
2. Ve a **Admin → Claves API**
3. Introduce tu key
4. Guarda

> 💡 Finnhub proporciona datos complementarios como noticias y métricas.

### Google Gemini (IA)

1. Obtén una API key en [Google AI Studio](https://aistudio.google.com)
2. Ve a **Admin → Inteligencia Artificial**
3. Pega la key
4. Selecciona el modelo (recomendado: `gemini-1.5-flash`)
5. Guarda

---

## 📧 Configuración SMTP

Para que la app pueda enviar emails (alertas, códigos 2FA, etc.):

### Campos

| Campo | Ejemplo |
|-------|---------|
| Host | `smtp.gmail.com` |
| Puerto | `587` |
| Usuario | `tu@gmail.com` |
| Contraseña | Contraseña de aplicación |
| From | `noreply@tuapp.com` |

### Gmail

Si usas Gmail:
1. Activa la verificación en 2 pasos
2. Genera una [Contraseña de Aplicación](https://myaccount.google.com/apppasswords)
3. Usa esa contraseña en el campo SMTP

### Probar Configuración

1. Configura SMTP
2. Introduce tu email en "Email de prueba"
3. Haz clic en **"Enviar prueba"**
4. Verifica que recibes el email

---

## 🤖 Configuración de IA

### Modelo

Selecciona el modelo de Gemini a usar:

| Modelo | Características |
|--------|-----------------|
| `gemini-1.5-flash` | Rápido, económico, recomendado |
| `gemini-1.5-pro` | Más potente, más lento |
| `gemini-2.0-flash` | Última versión experimental |

### Prompts Personalizables

Puedes personalizar el comportamiento de la IA editando los prompts:

**ChatBot (Conversacional)**
- Variables disponibles: `{{CHAT_HISTORY}}`, `{{MARKET_DATA}}`
- Usado en el chat con el usuario

**Análisis (Reporte)**
- Variables: `{{PORTFOLIO_CONTEXT}}`, `{{MARKET_CONTEXT}}`, `{{USER_MESSAGE}}`
- Usado para análisis detallados de cartera

### Refrescar Modelos

Si Google lanza nuevos modelos:
1. Haz clic en **"Refrescar"** junto al selector
2. Se actualizará la lista de modelos disponibles

---

## 📈 Sincronización de Mercado

### ¿Qué Sincroniza?

- **Precios históricos** de acciones (Yahoo Finance)
- **Tipos de cambio** de divisas (EUR/USD, EUR/GBP, etc.)

### Sincronización Automática

- **Diaria a las 04:00 AM** (hora Madrid): Últimos 5 días
- **Domingos a las 04:00 AM**: Últimos 6 meses completos

### Sincronización Manual

1. Ve a **Admin → Mercado**
2. Selecciona el periodo:
   - 5 Días
   - 1 Mes
   - 6 Meses
   - 1 Año
   - 2 Años
   - 5 Años
3. Haz clic en:
   - **Sincronizar TODO** (recomendado)
   - Solo Acciones
   - Solo Divisas

> ⚠️ Periodos largos pueden tardar varios minutos

---

## 💾 Backup y Restauración

### Exportar Backup

**Formato JSON** (recomendado):
1. Ve a **Admin → Backup**
2. Haz clic en **"Descargar JSON"**
3. Se descarga `stocks-manager-backup-YYYY-MM-DD.json`

**Formato SQL**:
1. Haz clic en **"Descargar SQL"**
2. Se descarga un script SQL con todos los datos

### Restaurar Backup

> ⚠️ **CUIDADO**: Esto REEMPLAZA todos los datos actuales

1. Ve a **Admin → Backup**
2. Haz clic en **"Restaurar desde archivo"**
3. Selecciona tu archivo `.json` o `.sql`
4. Confirma la restauración
5. Cierra sesión y vuelve a entrar

### Recomendaciones

- Haz backup **semanal** como mínimo
- Guarda backups en ubicación externa (cloud, NAS)
- Prueba restaurar en entorno de test periódicamente

---

## 📊 Monitorización

### Estadísticas del Sistema

En **Admin → Estadísticas** puedes ver:

| Métrica | Descripción |
|---------|-------------|
| Usuarios totales | Número de cuentas registradas |
| Usuarios bloqueados | Cuentas bloqueadas |
| Portfolios | Total de carteras |
| Posiciones | Número de posiciones activas |
| Transacciones | Operaciones registradas |

### Logs

Los logs del contenedor se pueden ver con:

```bash
docker logs stocks_app
docker logs stocks_app --tail 100 -f  # Últimas 100 líneas en tiempo real
```

### Verificar Estado

```bash
# Ver contenedores
docker ps

# Ver recursos
docker stats
```

---

## 🔧 Solución de Problemas

### La app no arranca

1. Verifica logs: `docker logs stocks_app`
2. Comprueba que PostgreSQL está healthy: `docker ps`
3. Revisa variables de entorno en `.env`

### No llegan emails

1. Verifica configuración SMTP
2. Prueba con "Enviar prueba"
3. Revisa logs para errores de conexión
4. Si usas Gmail, verifica la contraseña de aplicación

### Datos de mercado no se actualizan

1. Ve a Admin → Mercado
2. Ejecuta sincronización manual
3. Verifica conectividad con Yahoo Finance

### Usuario no puede entrar (2FA)

1. Ve a Admin → Usuarios
2. Busca al usuario
3. Haz clic en "Reset 2FA" (icono llave)
4. El usuario podrá entrar y reconfigurar 2FA

### Base de datos corrupta

1. Para la app: `docker compose stop app`
2. Restaura un backup previo
3. Reinicia: `docker compose up -d`

---

## 🔒 Seguridad

### Recomendaciones

- ✅ Usa HTTPS con certificado SSL
- ✅ Cambia las contraseñas por defecto
- ✅ Activa 2FA para todos los admins
- ✅ Limita acceso por IP si es posible
- ✅ Haz backups regulares
- ✅ Mantén Docker actualizado

### Primer Admin

El primer usuario registrado se convierte automáticamente en admin. Después:
- Solo un admin puede crear otros admins
- No se puede eliminar el último admin

---

*Stocks Manager v2.0 - Guía de Administrador*
