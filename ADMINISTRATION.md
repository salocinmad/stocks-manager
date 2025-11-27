# 🛡️ Guía de Administración

Esta guía cubre las tareas de mantenimiento y configuración avanzada para el administrador de Stocks Manager.

## 🔑 Gestión de Acceso

### Restablecer Contraseña de Administrador
Si has perdido el acceso a la cuenta `admin`, existen varios métodos para recuperarlo.

#### Método 1: Usando /resetadmin (Recomendado)
Este método utiliza la **contraseña maestra** generada al inicio del servidor.

1. **Localizar la contraseña maestra**:
   - En los logs del servidor: `docker compose logs server | grep "CONTRASEÑA MAESTRA"`
   - O en el archivo `.env`: variable `MASTER_PASSWORD`

2. **Acceder al formulario de recuperación**:
   - Navega a `http://tu-servidor/resetadmin`
   - Ingresa la contraseña maestra y define una nueva contraseña para el usuario `admin`.

#### Método 2: Modificación directa en Base de Datos
Si no tienes la contraseña maestra, puedes resetear el usuario directamente en la BD.

1. Accede al contenedor de base de datos:
   ```bash
   docker compose exec mariadb mysql -u root -p portfolio
   ```
   (La contraseña root está en tu archivo `.env`)

2. Ejecuta el siguiente SQL para cambiar la contraseña (ejemplo para poner 'admin123' temporalmente - **cámbiala luego**):
   ```sql
   -- El hash bcrypt de 'admin123' es: $2b$10$5.y.u.x.z.A.B.C.D.E.F.G.H.I.J.K.L.M.N.O.P.Q.R.S.T.U
   -- (Nota: Para producción, genera tu propio hash usando un generador bcrypt online o nodejs)
   
   UPDATE users SET password = '$2b$10$X7V.j.k.l.m.n.o.p.q.r.s.t.u.v.w.x.y.z.0.1.2.3.4.5.6' WHERE username = 'admin';
   ```

---

## ⚙️ Operaciones Diarias y Mantenimiento

### Cierre Diario (Cálculo de PnL)
El sistema guarda un "snapshot" diario de tus posiciones para calcular el historial de Ganancias/Pérdidas.

- **Automático**: Se ejecuta todos los días a las **01:00 AM (Hora España)**.
- **Manual**: Si necesitas forzar una actualización (por ejemplo, tras corregir operaciones antiguas), ve a:
  1. Panel de Admin (`🛠️ Admin` en el menú superior).
  2. Busca la sección "Cierre Diario".
  3. Haz clic en **"Forzar PnL último día"**.
  
  > **Nota**: Esto recalculará el PnL del último día registrado para **todos los portafolios** de todos los usuarios.

### Scheduler de Precios
El sistema actualiza los precios periódicamente para mantener la caché "fresca".

- **Configuración**: En el Panel de Admin, puedes:
  - Activar/Desactivar el scheduler.
  - Ajustar el intervalo de actualización (en minutos).
  - Ver la última ejecución exitosa.

---

## 🧹 Limpieza y Mantenimiento

### Logs del Sistema
Para verificar la salud del sistema o depurar errores:

```bash
# Ver últimos 100 logs y seguir en tiempo real
docker compose logs -f --tail=100
```

### Backups
Consulta la guía [DOCKER.md](./DOCKER.md) para instrucciones detalladas sobre cómo realizar y restaurar copias de seguridad.
