# Manual de Administración Avanzada

Esta sección está dirigida al usuario administrador o "propietario" de la instancia de Stocks Manager. Aquí aprenderás a mantener la aplicación saludable y segura.

## 1. Configuración de Servicios Externos (API Keys)

Para que el buscador de empresas funcione y los precios se actualicen correctamente, Stocks Manager utiliza un servicio llamado **Finnhub**.

### ¿Cómo obtener una API Key GRATIS?
1.  Ve a [https://finnhub.io/](https://finnhub.io/).
2.  Regístrate (Sign up) para una cuenta gratuita.
3.  En tu panel de control (Dashboard), verás una cadena de caracteres llamada **"API Key"**. Cópiala.

### ¿Cómo configurarla en Stocks Manager?
1.  Inicia sesión en Stocks Manager como administrador.
2.  Ve a **Configuración** (icono de usuario -> Config).
3.  Busca el campo **"Finnhub API Key"**.
4.  Pega la clave que copiaste y guarda.
5.  ¡Listo! Ahora el buscador de acciones funcionará perfectamente.

---

## 2. Recuperación de Contraseña de Administrador

¿Has olvidado tu contraseña y no puedes entrar? No te preocupes, puedes restablecerla desde la "trastienda" (terminal).

1.  Abre la terminal en la carpeta donde tienes instalado Stocks Manager.
2.  Asegúrate de que la aplicación está funcionando (`docker compose ps`).
3.  Ejecuta este comando mágico:

```bash
docker compose exec server node scripts/resetAdminPassword.js NUEVACONTRASEÑA
```

*(Sustituye `NUEVACONTRASEÑA` por la que quieras poner)*.

Si quieres cambiar la contraseña de otro usuario (no admin), añade su nombre al final:

```bash
docker compose exec server node scripts/resetAdminPassword.js NUEVACONTRASEÑA nombreusuario
```

---

## 3. Copias de Seguridad (Backups)

Tus datos son sagrados. Aquí te explicamos cómo guardarlos a buen recaudo.

Los datos viven dentro de un "volumen" de Docker llamado `mariadb_data`.

### Hacer una copia de seguridad rápida (SQL Dump)
Este comando crea un archivo `.sql` con todas tus operaciones, usuarios y carteras.

```bash
docker compose exec mariadb mysqldump -u user -ppassword portfolio_manager > backup_fecha.sql
```
*(Nota: Si cambiaste las contraseñas de la base de datos en el archivo `.env`, usa esas credenciales)*.

Guarda ese archivo `backup_fecha.sql` en un disco duro externo, en la nube o donde prefieras.

### Restaurar una copia de seguridad
Si se rompe todo y quieres volver atrás:

```bash
docker compose exec -T mariadb mysql -u user -ppassword portfolio_manager < backup_fecha.sql
```

---

## 4. Actualización de la Aplicación

Si hay una nueva versión de Stocks Manager disponible en GitHub:

1.  Descarga el nuevo código (o haz `git pull` si usaste Git).
2.  Detén la versión actual:
    ```bash
    docker compose down
    ```
3.  Vuelve a construir y arrancar (esto actualizará todo):
    ```bash
    docker compose up -d --build
    ```

---

## 5. Logs y Diagnóstico

Si algo falla y necesitas ver qué ocurre "por dentro":

*   **Ver logs del servidor:**
    ```bash
    docker compose logs -f server
    ```
    *(Pulsa Ctrl+C para salir)*.

*   **Ver logs de la base de datos:**
    ```bash
    docker compose logs -f mariadb
    ```
