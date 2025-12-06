# Manual de Usuario

Esta guía te enseñará a utilizar todas las funciones de Stocks Manager para llevar tu gestión de inversiones al siguiente nivel.

## 1. Primeros Pasos

### Inicio de Sesión
Accede a [http://localhost:3000](http://localhost:3000). Ingresa tu usuario y contraseña.
*   Si es la primera vez, usa `admin` / `admin123`.

### El Panel Principal (Dashboard)
Al entrar, verás el centro de control de tus inversiones:
*   **Valor Total:** La suma actual de todo tu dinero invertido + ganancias.
*   **Resumen de Ganancias:** Un gráfico circular que muestra cuánto es dinero invertido y cuánto es beneficio neto.
*   **Lista de Posiciones:** Tus acciones actuales, con su precio en tiempo real y rendimiento.

---

## 2. Gestión de Carteras (Portafolios)

Stocks Manager te permite tener varias "carteras" separadas. Por ejemplo, puedes tener una para tus ahorros personales y otra simulada para pruebas.

*   **Crear nueva cartera:** Haz clic en el botón "⚙️ Portafolios" (junto al selector de carteras arriba a la izquierda) y selecciona "➕ Crear". Dale un nombre (ej. "Largo Plazo").
*   **Cambiar de cartera:** Usa el menú desplegable arriba a la izquierda para saltar entre tus carteras.
*   **Favorita:** Puedes marcar una cartera como favorita con "⭐" para que se abra automáticamente al iniciar sesión.

---

## 3. Añadir Operaciones (Compras y Ventas)

Para registrar una inversión, debes añadir una operación. No añades "acciones" directamente, sino que registras que has "comprado" o "vendido" algo.

1.  Haz clic en el botón verde **"➕ Comprar"**.
2.  **Buscar Empresa:** Escribe el nombre o símbolo (ticker) en el buscador.
    *   *Ejemplo:* Escribe `Apple` o `AAPL`.
    *   *Nota:* Si la búsqueda no funciona, asegúrate de haber configurado la API Key (ver sección Administración).
3.  **Completar Datos:**
    *   **Acciones:** Cantidad comprada.
    *   **Precio:** Precio por acción al que compraste.
    *   **Divisa:** La moneda original de la acción (USD para Apple, EUR para Inditex).
    *   **Cambio (Exchange Rate):** Si compraste en dólares pero tu cuenta está en euros, indica cuánto valía 1 dólar en euros ese día (ej. 0.92). Si compraste en euros, déjalo en 1.
    *   **Comisión:** Gastos del broker.
    *   **Fecha:** Día de la compra.
4.  Haz clic en **"Guardar Compra"**.

Para vender, el proceso es similar pero usando el botón rojo **"➖ Vender"**. El sistema calculará automáticamente tus ganancias basándose en tus compras anteriores.

---

## 4. Seguimiento y Análisis

### Precios en Tiempo Real
La aplicación actualiza los precios automáticamente.
*   Puedes forzar una actualización pulsando el botón **"🔄 Actualizar Precios"**.
*   Verás el precio actual, la variación diaria (en % y valor) y el valor total de tu posición.

### Gráficos
*   **Inversión vs Ganancias:** Te dice de un vistazo si estás en verde o en rojo globalmente.
*   **Contribución:** Muestra qué porcentaje de tu cartera representa cada empresa (ej. Apple es el 20% de tu dinero).
*   **Histórico (StockHistory):** Al hacer clic en el nombre de una empresa en la lista, se despliega un gráfico con la evolución de su precio.

### Notas Personales 📝
¿Por qué compraste esa acción? ¿A qué precio planeas vender?
*   Haz clic en el botón **"📝 Nota"** junto a cualquier posición.
*   Escribe tus pensamientos. Puedes usar formato **negrita**, listas, etc. (El sistema usa Markdown).
*   Estas notas son privadas y solo para ti.

### Botones Externos 🔗
Puedes configurar accesos rápidos a webs externas para cada acción.
*   Ve al menú de usuario (tu icono arriba a la derecha) -> **"🔗 Botones Externos"**.
*   Añade un botón nuevo. *Ejemplo:* Nombre "Yahoo", URL `https://finance.yahoo.com/quote/`.
*   Ahora, en cada fila de tus acciones, verás un icono pequeño que te lleva directo a la página de Yahoo de esa acción.

---

## 5. Reportes e Informes

Si necesitas un resumen para imprimir o guardar:
1.  Haz clic en el botón **"📊 Análisis"** o **"Reportes"** en la barra superior.
2.  Selecciona el tipo de informe (Mensual, Anual, Dividendos - si aplica).
3.  Podrás visualizar tablas detalladas de rendimiento y exportarlas.

---

## 6. Configuración de Usuario

En el menú de usuario (arriba a la derecha) -> **"⚙️ Config"**:
*   **Cambiar Contraseña:** Es vital cambiar la contraseña por defecto.
*   **API Key:** Aquí es donde se introduce la clave de Finnhub para que el buscador funcione.
*   **2FA (Doble Factor):** Puedes activar seguridad extra. Escanea el código QR con tu móvil (Google Authenticator) y cada vez que entres te pedirá un código temporal. ¡Muy recomendado!
