# Guía de Instalación Fácil con Docker

Esta guía te acompañará paso a paso para instalar Stocks Manager en tu ordenador. No necesitas ser un experto en informática, solo seguir estas instrucciones.

El método que utilizaremos se basa en **Docker**. Docker es una tecnología que nos permite empaquetar la aplicación completa (servidor, base de datos, web) en "contenedores" listos para usar, evitando que tengas que instalar y configurar cada pieza por separado.

---

## 1. Requisitos Previos

Antes de empezar, necesitas instalar dos programas fundamentales. Si ya los tienes, puedes saltar al paso 2.

### A. Docker Desktop
Es el motor que hará funcionar la aplicación.
1.  Ve a la web oficial: [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
2.  Descarga la versión para tu sistema operativo (Windows, Mac o Linux).
3.  Instálalo como cualquier otro programa (Siguiente > Siguiente > Finalizar).
4.  **Importante:** Una vez instalado, abre "Docker Desktop" y espera a que el icono de la ballena o el estado diga "Engine running" (en verde). Docker debe estar abierto para que la aplicación funcione.

### B. Git (Opcional pero recomendado)
Sirve para descargar el código de la aplicación fácilmente.
*   Descarga desde: [https://git-scm.com/downloads](https://git-scm.com/downloads)

---

## 2. Descargar la Aplicación

Tienes dos formas de hacerlo:

### Opción A: Usando Git (Recomendado)
Abre una terminal (en Windows puedes buscar "PowerShell" o "CMD" en el menú de inicio) y escribe:

```bash
git clone https://github.com/tu-usuario/stocks-manager.git
cd stocks-manager
```

### Opción B: Descarga Directa (Sin Git)
1.  Ve a la página del proyecto en GitHub.
2.  Busca el botón verde que dice **"<> Code"**.
3.  Selecciona **"Download ZIP"**.
4.  Descomprime el archivo ZIP descargado en una carpeta de tu ordenador (por ejemplo, en `Documentos/stocks-manager`).
5.  Abre esa carpeta.

---

## 3. Iniciar la Aplicación

Este es el momento mágico donde todo se pone en marcha.

1.  Abre una terminal dentro de la carpeta del proyecto.
    *   **Truco en Windows:** Entra en la carpeta `stocks-manager`, haz clic derecho en un espacio vacío y selecciona "Abrir en Terminal" (o escribe `cmd` en la barra de direcciones de la carpeta y pulsa Enter).
2.  Escribe el siguiente comando y pulsa Enter:

```bash
docker compose up -d
```

### ¿Qué está pasando?
*   Verás muchas líneas de texto descargando cosas ("pulling", "downloading"). Es normal, está bajando las piezas necesarias.
*   Al final, deberías ver mensajes en verde que dicen `Started` o `Running` para `mariadb`, `server` y `frontend`.

---

## 4. Acceder a Stocks Manager

Una vez que la terminal haya terminado y te deje escribir de nuevo:

1.  Abre tu navegador web favorito (Chrome, Firefox, Edge...).
2.  Escribe la siguiente dirección: [http://localhost:3000](http://localhost:3000)
3.  ¡Deberías ver la pantalla de inicio de sesión de Stocks Manager!

### Credenciales por Defecto
Para entrar por primera vez, usa estos datos:

*   **Usuario:** `admin`
*   **Contraseña:** `admin123`

⚠️ **Nota de Seguridad:** Nada más entrar, ve a **Configuración** (icono de usuario arriba a la derecha -> Config) y cambia tu contraseña.

---

## 5. Detener la Aplicación

Cuando termines de usar la aplicación, puedes dejarla corriendo en segundo plano (no consume mucho) o apagarla.

Para apagarla, vuelve a la terminal en la carpeta del proyecto y escribe:

```bash
docker compose down
```

Esto detendrá y guardará todo de forma segura.

---

## Solución de Problemas Comunes

**Problema: Me dice "Port already in use" (Puerto en uso).**
*   **Causa:** Tienes otro programa usando el puerto 3000 (web) o 3306 (base de datos).
*   **Solución:** Edita el archivo `docker-compose.yml` con un bloc de notas. Cambia donde dice `"3000:80"` por `"3001:80"`. Luego intenta acceder por `http://localhost:3001`.

**Problema: La página no carga inmediatamente.**
*   **Causa:** La primera vez, la base de datos tarda unos segundos en inicializarse.
*   **Solución:** Espera 1 minuto y recarga la página (F5).

**Problema: Docker no arranca.**
*   **Solución:** Asegúrate de que has abierto la aplicación "Docker Desktop" antes de ejecutar los comandos en la terminal.
