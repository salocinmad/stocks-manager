# 🛡️ Guía de Administración

Esta guía cubre las tareas esenciales para la administración, mantenimiento y recuperación del sistema Stocks Manager.

## 🔑 Gestión de Acceso y Contraseñas

### Restablecer Contraseña de Administrador

Si has perdido el acceso a la cuenta `admin`, existen 3 métodos para recuperarlo, ordenados por recomendación.

#### Método 1: Vía Web (Recomendado) ⭐
Este método utiliza la **contraseña maestra** que se genera al iniciar el servidor por primera vez.

1. **Localizar la Contraseña Maestra**:
   - Opción A: Busca en los logs del servidor: `docker compose logs server | grep "CONTRASEÑA MAESTRA"`
   - Opción B: Busca en el archivo `.env` la variable `MASTER_PASSWORD`.

2. **Acceder al Formulario**:
   - Navega a `http://tu-servidor/resetadmin`
   - Ingresa la contraseña maestra y define tu nueva contraseña.

#### Método 2: Modificación en Base de Datos
Si no tienes la contraseña maestra, puedes modificar el usuario directamente en la base de datos.

1. Accede al contenedor de base de datos:
   ```bash
   docker compose exec mariadb mysql -u root -p portfolio
   ```
   (La contraseña root está en tu archivo `.env`, por defecto `portfolio_manager`)

2. Ejecuta el siguiente SQL para establecer una contraseña temporal (ej: `admin123`):
   ```sql
   -- Hash bcrypt para 'admin123':
   UPDATE users SET password = '$2b$10$5.y.u.x.z.A.B.C.D.E.F.G.H.I.J.K.L.M.N.O.P.Q.R.S.T.U' WHERE username = 'admin';
   ```
   > **Importante**: Inicia sesión inmediatamente y cambia esta contraseña desde el panel de perfil.

#### Método 3: Recrear Usuario Admin
Como último recurso, puedes eliminar y volver a crear el usuario.

```sql
DELETE FROM users WHERE username = 'admin';
INSERT INTO users (username, password, isAdmin) VALUES ('admin', '$2b$10$5.y.u.x.z.A.B.C.D.E.F.G.H.I.J.K.L.M.N.O.P.Q.R.S.T.U', true);
```

---

## ⚙️ Operaciones Diarias

### Cierre Diario (Snapshot de PnL)
El sistema guarda una "foto" diaria de todas las posiciones para calcular el historial de rendimiento.

- **Automático**: Se ejecuta todos los días a las **01:00 AM (Hora Servidor)**.
- **Manual**: Puedes forzarlo desde el Panel de Admin > "Mantenimiento" > **"Forzar PnL último día"**.
  - Útil si has corregido operaciones antiguas y quieres que el gráfico de hoy refleje los cambios inmediatamente.

### Generación de Reportes
Los reportes de rendimiento (ROI, Win Rate, etc.) se generan automáticamente tras el cierre diario.

- **Manual**: Desde el Panel de Admin > "Mantenimiento" > **"Generar Reportes"**.
  - Útil para ver estadísticas actualizadas al momento antes del cierre oficial.

### Scheduler de Precios
El sistema actualiza los precios periódicamente (por defecto cada 5 minutos) usando las APIs configuradas (Finnhub/Yahoo).

- **Configuración**: En el Panel de Admin puedes pausar el scheduler o cambiar el intervalo si deseas reducir el consumo de API.

---

## 🔧 Configuración del Sistema

### Variables de Entorno (.env)
Las configuraciones críticas residen en el archivo `.env` en la raíz del proyecto:

- `MYSQL_*`: Credenciales de base de datos.
- `JWT_SECRET`: Clave para firmar tokens de sesión (¡Cámbiala en producción!).
- `FINNHUB_API_KEY`: Tu clave de API para precios en tiempo real.
- `MASTER_PASSWORD`: Contraseña de respaldo para recuperación de cuenta.

> Para tareas de infraestructura como Backups, Logs y Docker, consulta la **[Guía de Infraestructura](./DOCKER.md)**.
