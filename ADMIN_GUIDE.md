# Manual de Administración Avanzada

Esta guía está dirigida al administrador del sistema. Aquí encontrarás cómo configurar, mantener y proteger tu instancia de **Stocks Manager**.

---

## 1. Configuración del Sistema

### API Key de Finnhub (Precios en Tiempo Real)
Para que las acciones americanas tengan precios en tiempo real, necesitas una API Key gratuita de Finnhub.

1.  Regístrate en [finnhub.io](https://finnhub.io/) y obtén tu **API Key**.
2.  En Stocks Manager, ve a **Configuración** ⚙️.
3.  Pega la clave en el campo **"Finnhub API Key"** y guarda.

### Configuración de Correo (SMTP)
Si deseas recibir alertas por correo:
1.  Ve al Panel de Administración (`/admin`).
2.  Configura los datos de tu servidor SMTP (Host, Puerto, Usuario, Contraseña).
3.  Realiza un envío de prueba para asegurar que funciona.

---

## 2. Copias de Seguridad (Backups)

El sistema incluye una herramienta integrada para gestionar backups completos de tu base de datos. Es vital realizarlos periódicamente.

### Exportar Backup
Desde el **Panel de Administración -> Backups**:
- **Formato JSON**: Recomendado para portabilidad y lectura humana.
- **Formato SQL**: Recomendado para restauraciones rápidas a nivel de base de datos directa.

Al exportar, se descargará un archivo a tu ordenador con todos los datos (usuarios, carteras, operaciones, configuraciones, etc.).

### Restaurar Backup
⚠️ **Advertencia**: Restaurar un backup **borrará todos los datos actuales** y los reemplazará por los del archivo de respaldo.
1.  En el Panel de Administración -> Backups.
2.  Selecciona tu archivo `.json` o `.sql`.
3.  Confirma la operación.

---

## 3. Gestión de Usuarios y Contraseñas

### Recuperación de Contraseña de Administrador

Existen dos métodos para recuperar el acceso si has perdido la contraseña de administrador.

#### Método 1: Web (Recomendado)
El método más sencillo es usar la página de recuperación integrada.

1.  Accede a `https://midominio.com/resetadmin` (o `http://localhost:5173/resetadmin`).
2.  Deberás introducir la **Contraseña Maestra (Master Password)** de la instalación.
    *   Esta contraseña se genera aleatoriamente en la primera instalación y se muestra en los logs.
    *   También puedes encontrarla en la variable `MASTER_PASSWORD` dentro del archivo `.env` del servidor.
3.  Introduce la nueva contraseña para el usuario `admin` y confirma.

#### Método 2: Terminal (Avanzado)
Si no tienes la contraseña maestra, puedes resetear la contraseña directamente desde el servidor:

```bash
# Si usas Docker (recomendado):
docker compose exec server node scripts/resetAdminPassword.js "NUEVA_CONTRASEÑA"

# Si usas instalación local:
cd server
node scripts/resetAdminPassword.js "NUEVA_CONTRASEÑA"
```

### Gestión de Usuarios
Desde el menú **Admin -> Usuarios**, puedes ver la lista de usuarios registrados en el sistema, darles privilegios de administrador o eliminarlos si fuera necesario.

---

## 4. Mantenimiento y Actualizaciones

### Cierre Diario (Daily Close)
El sistema ejecuta automáticamente un proceso ("Job") cada madrugada (hora España) para guardar una "foto" (snapshot) del valor de las acciones. Esto permite generar las gráficas históricas.
- Puedes verificar su estado en el panel Admin.
- Puedes forzar una ejecución manual si el servidor estuvo apagado durante la noche.

### Actualizar la Aplicación
Para actualizar a la última versión del código (si usas Docker):

1.  Descarga los cambios:
    ```bash
    git pull
    ```
2.  Reconstruye y reinicia:
    ```bash
    docker compose down
    docker compose up -d --build
    ```

---

## 5. Solución de Problemas (Troubleshooting)

- **Precios no se actualizan**:
  - Verifica que tu API Key de Finnhub sea válida.
  - Comprueba que el servidor tenga conexión a internet.
  - Revisa los logs: `docker compose logs -f server`.

- **Error de base de datos / Conexión**:
  - Asegúrate de que el contenedor `mariadb` está corriendo (`docker compose ps`).
  - Si cambiaste credenciales en `.env`, asegúrate de reconstruir el contenedor.
