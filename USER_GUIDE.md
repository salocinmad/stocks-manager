# Manual de Usuario

Bienvenido a **Stocks Manager**. Esta guía te explicará cómo utilizar las funciones principales de la aplicación para gestionar tus inversiones eficientemente.

---

## 1. Panel Principal (Dashboard)

El panel principal es tu centro de mando. Aquí verás de un vistazo el estado de tu cartera.

### Resumen de Cartera
En la parte superior encontrarás tarjetas con información clave:
- **Capital Invertido**: Dinero total que has puesto de tu bolsillo.
- **Valor Actual**: Valor de mercado de tus activos en este momento.
- **Rentabilidad**: Tu ganancia o pérdida total (PnL) expresada en Euros y porcentaje.
- **Liquidez**: Dinero disponible (si gestionas efectivo en la app).

### Lista de Posiciones Activas
Es el corazón de la aplicación. Muestra todas las acciones que posees actualmente.
- **Detalles**: Nombre, símbolo, número de acciones, precio promedio de compra y precio actual.
- **Badges de Fuente**: Verás iconos (Finnhub/Yahoo) indicando de dónde viene el precio actual.
- **Rentabilidad Individual**: Cada fila muestra cuánto estás ganando o perdiendo con esa acción específica.
- **Acciones Rápidas**:
  - `✏️`: Editar notas o revisar detalles.
  - `🗑️`: Vender o cerrar posición (abre el modal de venta).

---

## 2. Gestión de Operaciones

### Añadir una Operación (Compra)
Para registrar una nueva compra:
1.  Haz clic en el botón **"+ Nueva Operación"** o **"Comprar"**.
2.  **Buscador**: Escribe el nombre o símbolo de la empresa (ej: "Apple", "MSFT", "SAN.MC"). El sistema te sugerirá resultados.
3.  **Datos**: Introduce la Fecha, Cantidad de acciones, Precio por acción y Comisiones (si las hay).
4.  **Guardar**: La operación se añadirá y recalculará tus promedios automáticamente.

### Registrar una Venta
1.  Busca la posición que quieres vender en la lista.
2.  Haz clic en el botón de acción correspondiente o usa el botón general de "Venta".
3.  Selecciona la cantidad de acciones a vender y el precio de venta.
4.  El sistema calculará automáticamente la ganancia o pérdida realizada (Realized PnL) basándose en el método FIFO.

---

## 3. Gráficas y Análisis

### Contribución por Empresa
Un gráfico circular ("tarta") que muestra visualmente cómo está distribuido tu dinero. Ideal para ver si estás demasiado expuesto a una sola compañía.

### Evolución PnL (Últimos 30 días)
Un gráfico de líneas que muestra la tendencia de tus ganancias/pérdidas diarias. Te ayuda a entender la volatilidad reciente de tu cartera.

---

## 4. Seguridad: Doble Factor (2FA)

Recomendamos encarecidamente activar la seguridad extra.

1.  Ve al menú de usuario (arriba a la derecha) -> **Configuración**.
2.  En la sección "Autenticación en Dos Pasos (2FA)", haz clic en **Activar**.
3.  Escanea el código QR con tu aplicación favorita (Google Authenticator, Authy, Microsoft Authenticator).
4.  Introduce el código de 6 dígitos que te da la app para confirmar.
5.  ¡Listo! Ahora necesitarás tu móvil para iniciar sesión, protegiendo tu dinero de accesos no autorizados.

---

## 5. Preguntas Frecuentes

**¿Por qué mis acciones de EE.UU. cambian de valor aunque el mercado esté cerrado?**
Esto se debe a la fluctuación del cambio Euro/Dólar (EUR/USD). Stocks Manager valora tu cartera en Euros, por lo que si el Dólar sube o baja, el valor de tus acciones americanas se ajustará aunque su precio en dólares no cambie.

**¿Qué significan los iconos pequeños de Yahoo/Finnhub?**
Indican la fuente del precio.
- ☁️ **Finnhub**: Precio en tiempo real (mercado US).
- 🟣 **Yahoo**: Precio diferido o cierre del día anterior (según mercado).

**¿Cómo añado notas a una acción?**
Haz clic en el icono de "lápiz" o "nota" en la fila de la acción. Es útil para anotar por qué compraste, precios objetivo o estrategias.
