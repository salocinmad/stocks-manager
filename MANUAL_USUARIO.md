# 📖 Manual de Usuario - Stocks Manager

Versión 2.1.0 | Última actualización: Enero 2026

---

## 📑 Índice

1. [Introducción](#-introducción)
2. [Primeros Pasos](#-primeros-pasos)
3. [Dashboard](#-dashboard)
4. [Gestión de Portfolios](#-gestión-de-portfolios)
5. [Operaciones de Compra/Venta](#-operaciones-de-compraventa)
6. [Análisis de Posiciones](#-análisis-de-posiciones-nuevo)
7. [Alertas de Precio](#-alertas-de-precio)
8. [Watchlists](#-watchlists)
9. [Reportes Fiscales](#-reportes-fiscales)
10. [ChatBot IA](#-chatbot-ia)
11. [Calendario Financiero](#-calendario-financiero)
12. [Configuración de Perfil](#-configuración-de-perfil)
13. [Preguntas Frecuentes](#-preguntas-frecuentes)

---

## 🎯 Introducción

### ¿Qué es Stocks Manager?

Stocks Manager es una aplicación de gestión de carteras de inversión que te permite:

- 📊 **Visualizar** el rendimiento de tus inversiones en tiempo real
- 💰 **Registrar** operaciones de compra y venta
- 📈 **Analizar** tu cartera con gráficos profesionales
- 🔔 **Recibir alertas** cuando un activo alcance un precio objetivo
- 📋 **Generar reportes fiscales** para la declaración de la renta
- 🤖 **Consultar a la IA** sobre estrategias y análisis de mercado

### Requisitos

- Navegador web moderno (Chrome, Firefox, Edge, Safari)
- Conexión a internet
- Cuenta de usuario registrada

---

## 🚀 Primeros Pasos

### Registro

1. Accede a la aplicación desde tu navegador
2. Haz clic en **"Registrarse"**
3. Completa el formulario con:
   - Nombre completo
   - Email
   - Contraseña (mínimo 6 caracteres)
4. Haz clic en **"Crear cuenta"**

### Inicio de Sesión

1. Introduce tu email y contraseña
2. Si tienes 2FA activado:
   - Introduce el código de 6 dígitos de tu app autenticadora
   - O usa un código de respaldo si no tienes acceso a la app
3. Haz clic en **"Iniciar sesión"**

### Configurar 2FA (Recomendado)

La autenticación de dos factores protege tu cuenta:

1. Ve a **Perfil → Seguridad**
2. Haz clic en **"Activar 2FA"**
3. Escanea el código QR con tu app (Google Authenticator, Authy)
4. **Descarga los códigos de respaldo** (¡importante!)
5. Confirma que los has guardado
6. Introduce el código de 6 dígitos para activar

> ⚠️ **Importante**: Guarda los códigos de respaldo en un lugar seguro. Si pierdes acceso a tu app autenticadora, los necesitarás para entrar.

---

## 📊 Dashboard

El Dashboard es tu página principal con un resumen de toda tu cartera. Presenta un **layout de dos columnas** para optimizar la visualización.

### Layout del Dashboard (v2.1.0)

**Columna Principal (75%):**
- **Fila 1**: Tarjetas de resumen (Patrimonio Neto, Variación Diaria, Ganancia Total)
- **Análisis IA**: Resultado del análisis aparece aquí cuando se genera
- **Fila 2**: Mejores del Día y Peores del Día (activos con mayor subida/bajada)
- **Fila 3**: Gráfico PnL (evolución de rentabilidad)

**Columna Lateral (25%):**
- **Análisis IA**: Botón para solicitar análisis estratégico con inteligencia artificial
- **Distribución por Sector**: Gráfico circular de tu cartera por sectores

### Elementos del Dashboard

| Sección | Descripción |
|---------|-------------|
| **Patrimonio Neto** | El valor actual de todas tus inversiones en EUR |
| **Variación Diaria** | Cambio en el valor de tu cartera hoy |
| **Ganancia Total** | Ganancia o pérdida total desde la inversión inicial |
| **Mejores/Peores del Día** | Top 3 activos con mayor subida/bajada hoy |
| **Gráfico PnL** | Evolución de tu rentabilidad en el tiempo |
| **Distribución por Sector** | Desglose de tu cartera por sectores industriales |

### Filtros del Gráfico PnL

Puedes filtrar el periodo del gráfico:
- **1M** - Último mes
- **3M** - Últimos 3 meses
- **1Y** - Último año

### Cambiar de Portfolio

Si tienes varios portfolios, puedes cambiar entre ellos desde el selector en la parte superior (dropdown premium).

---

## 💼 Gestión de Portfolios

### Crear un Portfolio

1. Ve a **Portfolio** en el menú lateral
2. Haz clic en el icono **"+"** o **"Nuevo Portfolio"**
3. Introduce un nombre (ej: "Cartera Largo Plazo")
4. Haz clic en **"Crear"**

### Editar Portfolio

1. Abre el portfolio que quieres editar
2. Haz clic en el icono de **configuración** (⚙️)
3. Modifica el nombre o configuración
4. Guarda los cambios

### Marcar como Favorito

El portfolio favorito es el que se muestra por defecto en el Dashboard:

1. Abre el portfolio
2. Haz clic en el icono de **estrella** (⭐)

### Añadir Posiciones

1. Abre tu portfolio
2. Haz clic en **"+ Añadir Posición"** o **"Entrada Manual"**
3. Busca el ticker del activo (ej: AAPL, MSFT, TEF.MC)
4. Introduce:
   - Cantidad de acciones
   - Precio de compra
   - Fecha de compra
   - Moneda
5. Haz clic en **"Guardar"**
 
 > 💡 **Soporte GBX (Londres)**: Si operas en la bolsa de Londres (LSE), puedes elegir la moneda **GBX** (Peniques). Introduce el precio en peniques (ej: 594.5) y el sistema calculará automáticamente el equivalente en EUR usando el tipo de cambio correcto.
 
 ### Editar una Posición
 
 Si necesitas corregir datos de una posición existente (ej: ajustar el precio medio o las comisiones):
 1. En tu portfolio, haz clic en el icono de **lápiz** (✏️) junto a la posición.
 2. Modifica:
    - Cantidad
    - Precio Promedio de Compra
    - **Comisión Total Acumulada**
 3. Guarda los cambios. El PnL se recalculará automáticamente.

 ### Actualización de Precios (NUEVO)

 Los precios de tu cartera se actualizan siguiendo estas reglas:
 - **Automático**: El sistema refresca los precios cada **5 minutos** si mantienes la página abierta.
 - **Manual**: Puedes forzar una actualización pulsando el botón **"Actualizar"** ubicado en la cabecera de la tabla de activos.
   - 🕒 Este botón tiene un **tiempo de espera de 60 segundos** entre usos para evitar saturar el servidor.
   - ⏳ Un contador te indicará cuántos segundos faltan para poder volver a actualizar.

---

## 💸 Operaciones de Compra/Venta

### Registrar una Compra

1. Ve a **Portfolio** o **Entrada Manual**
2. Selecciona el activo o busca uno nuevo
3. Elige **"Compra"**
4. Completa los datos:
   - Cantidad
   - Precio por unidad
   - Fecha
   - Comisiones (opcional)
5. Confirma la operación

### Registrar una Venta

1. En tu portfolio, haz clic en la posición
2. Selecciona **"Vender"**
3. Introduce:
   - Cantidad a vender
   - Precio de venta
   - Fecha
4. Confirma la operación

### Historial de Operaciones

Puedes ver y **editar** todas tus operaciones desde el nuevo Editor de Historial:

1. Abre tu portfolio
2. Haz clic en el botón **"Historial"** (icono de reloj) en la cabecera
3. Se abrirá un modal con la lista cronológica de todas las transacciones

#### Columnas del Historial
| Columna | Descripción |
|---------|-------------|
| Fecha | Fecha de la operación |
| Ticker | Símbolo del activo |
| **Empresa** | Nombre completo de la compañía (nuevo) |
| Tipo | COMPRA / VENTA / DIVIDENDO |
| Cantidad | Número de acciones |
| Precio | Precio por unidad |
| Comisión | Comisiones del broker |
| Divisa | Moneda de la operación |
| FX (a EUR) | Tipo de cambio usado |
| Acciones | Botón de edición |

#### Editar una Transacción

1. Haz clic en el icono de **lápiz** (✏️) de la fila
2. Modifica los campos editables (fecha, cantidad, precio, comisión, divisa, FX)
3. Haz clic en **✓** para guardar o **✗** para cancelar
4. El sistema **recalculará automáticamente** la posición actual (precio medio, cantidad)

> 💡 **Scroll Inteligente**: Al guardar cambios, la tabla mantiene tu posición de scroll para que puedas seguir editando filas consecutivas sin perderte.

> ⚠️ **Importante**: Editar transacciones antiguas corrige la posición actual pero no regenera el gráfico PnL histórico instantáneamente.

### Previsualización FIFO de Venta (NUEVO)

Al vender una posición, el sistema ahora muestra una **previsualización en tiempo real** del impacto financiero:

1. En tu portfolio, haz clic en **"Vender"** en una posición
2. Introduce la cantidad a vender
3. El sistema calcula automáticamente:
   - **Coste Base FIFO**: El coste de adquisición de las acciones específicas que vas a vender (primeras en entrar, primeras en salir)
   - **PnL Estimado**: Ganancia o pérdida esperada basada en el precio de venta introducido

> 🎯 Esta función te ayuda a tomar decisiones informadas antes de confirmar la operación.

### Importar desde Broker

Si tu broker permite exportar operaciones:

1. Ve a **Importadores**
2. Selecciona tu broker o formato
3. Sube el archivo (CSV, Excel)
4. Revisa las operaciones detectadas
5. Confirma la importación

---

---

## 🔬 Análisis de Posiciones (NUEVO)

Stocks Manager 2.1.0 introduce una potente herramienta de análisis para cada activo de tu cartera.

### Acceder al Análisis
1. En tu portfolio, haz clic en el icono de **gráficas** (📊) situado a la derecha de cualquier posición.
2. Se abrirá un modal con **6 pestañas de información detallada**.

### 1. 📈 Posición
Resumen de tu inversión: PnL, Precio Medio, Peso en Cartera y Desglose de Operaciones.

### 2. 📊 Técnico
Indicadores calculados automáticamente (RSI, Medias Móviles):
- **RSI (14)**: Indica si el activo está sobrecomprado (>70) o sobrevendido (<30).
- **Tendencia**: Detecta cruces de medias (Golden Cross / Death Cross).

### 3. ⚠️ Riesgo
Métricas avanzadas para evaluar la volatilidad:
- **Sharpe/Sortino Ratio**: Rentabilidad ajustada al riesgo.
- **VaR (Value at Risk)**: Pérdida máxima estimada en un día normal.
- **Score**: Puntuación de riesgo del 1 al 10.

### 4. 🏢 Fundamental (NUEVO)
Salud financiera y valoración de la empresa:
- **Valoración**: PER, PEG Ratio, EV/EBITDA y **Fair Value (Graham)** (Valor intrínseco teórico).
- **Rentabilidad**: ROE, Márgenes Operativos y Netos.
- **Dividendos**: Rentabilidad por dividendo (Yield) y fechas de pago.
- **Salud**: Deuda Total y disponibilidad de Caja.

### 5. 🎯 Analistas
Consenso de mercado provisto por Yahoo Finance:
- Recomendación media (Comprar/Vender).
- Precio Objetivo (Target Price) estimado por analistas.

### 6. 🔮 Simulador "What-If"
Herramienta para proyectar escenarios:
- *¿Qué pasa si compro 10 acciones más?*
- *¿Cómo cambia mi PnL si el precio sube un 5%?*

---

## 🔔 Alertas de Precio

Las alertas te notifican cuando un activo alcanza un precio objetivo.

### Crear una Alerta

1. Ve a **Alertas** en el menú lateral
2. Haz clic en **"+ Nueva Alerta"**
3. Busca el ticker del activo
4. Configura:
   - **Tipo**: Precio, Cambio %, Volumen o **Global**.
   - **Condición/Umbral**: El valor que dispara la alerta.

### Alertas Globales de Portafolio (NUEVO v2.4)
Esta potente función te permite vigilar **todos los activos** de un portafolio a la vez.

1. Selecciona la pestaña **"Global"**.
2. Elige el portafolio que quieres monitorizar.
3. Define un **Umbral de Movimiento (%)** (ej. 5%).
4. **¿Cómo funciona?**: El sistema revisará cada acción de tu cartera. Si **CUALQUIERA** de ellas sube o baja más de un 5% en el día, recibirás una notificación específica para esa acción (ej. "AAPL se mueve un +6%").
5. **Cooldown Inteligente**: Si AAPL dispara la alerta, esa acción específica "descansará" el tiempo que configures (ej. 24h), pero el resto de tu cartera (MSFT, GOOGL...) seguirá siendo vigilada activamente.

### Tipos de Notificación

Puedes recibir alertas por:
- 📧 **Email**
- 🔔 **Navegador** (notificaciones push)
- 📱 **Telegram** (requiere configuración)

### Gestionar Alertas

- **Activar/Desactivar**: Toggle para pausar una alerta sin eliminarla
- **Editar**: Modificar el precio objetivo
- **Eliminar**: Borrar la alerta permanentemente

---

## 👁️ Watchlists

Las watchlists te permiten seguir activos que NO tienes en cartera.

### Crear una Watchlist

1. Ve a **Watchlists** en el menú lateral
2. Haz clic en **"+ Añadir"**
3. Busca el ticker del activo
4. Haz clic en **"Añadir a Watchlist"**

### Ver Detalles

Haz clic en cualquier activo de tu watchlist para ver:
- Precio actual
- Cambio del día
- Gráfico histórico
- Noticias relacionadas

---

## 📋 Reportes Fiscales

Stocks Manager genera los informes necesarios para tu declaración de la renta en España.

### Informe de Ganancias/Pérdidas

1. Ve a **Reportes** en el menú lateral
2. Selecciona el **año fiscal**
3. Haz clic en **"Generar Informe"**

El informe incluye:
- Todas las ventas del año
- Precio de adquisición vs. precio de venta
- Ganancia/Pérdida por operación
- **Total para declarar en IRPF**

### Exportar a Excel

1. Genera el informe
2. Haz clic en **"Exportar Excel"**
3. Se descargará un archivo `.xlsx` con todos los datos

### Modelo D6 (Inversiones en el Extranjero)

Si tienes inversiones en activos extranjeros por valor superior a 50.000€, el informe D6 es obligatorio:

1. En Reportes, selecciona **"Modelo D6"**
2. Indica la fecha de referencia (31 de diciembre)
3. Genera el informe

> 💡 **Nota sobre comisiones**: Las comisiones de compra aumentan tu precio de adquisición, y las de venta reducen tu precio de transmisión. Esto reduce la ganancia patrimonial a declarar (Art. 35 LIRPF).

---

## 🤖 ChatBot IA

El ChatBot usa inteligencia artificial para ayudarte con análisis y consultas.

### Cómo Usar el ChatBot
 
 1. Haz clic en el icono del **bot** (💬) en la esquina inferior
 2. **Selecciona la Personalidad**: Arriba a la derecha del chat, puedes elegir entre:
    - 👔 **Asistente Estándar**: Profesional y equilibrado.
    - 🐺 **El Lobo**: Agresivo, busca rendimiento, tono desafiante.
    - 👨‍🏫 **Profesor**: Explicaciones sencillas y educativas.
    - *Y más opciones configuradas por el administrador (ej: Consultor Estratégico).*

 3. **Contexto Financiero**:
    El chatbot ahora tiene acceso a:
    - 📰 **Noticias recientes** sobre las empresas que mencionas.
    - 📊 **Datos Fundamentales** (PER, Capitalización, Precio Objetivo).
    - 📈 **Análisis Técnico** (RSI, Tendencias).
    - 🌍 **Sugerencias de Mercado**: Conoce las tendencias actuales del Motor de Descubrimiento.

 4. **Escribe tu consulta**:
    - *"Analiza mi cartera y dime si estoy muy expuesto a tecnología"*
    - *"¿Qué opinas de las acciones que son tendencia hoy?"*
    - *"Dame un análisis fundamental de AAPL"*
 5. **Espera la respuesta**

### Ejemplos de Preguntas

- "¿Cómo está mi cartera?"
- "Analiza AAPL"
- "¿Cuáles son los soportes y resistencias de Tesla?"
- "¿Debería vender mis acciones de Microsoft?"
- "¿Qué opinas de invertir en el sector tecnológico?"

### Limitaciones

- El ChatBot no tiene acceso a información en tiempo real de todos los mercados
- Sus consejos son orientativos, no recomendaciones de inversión profesionales
- No puede ejecutar operaciones por ti

---

## 📅 Calendario Financiero

El calendario te ayuda a planificar en función de eventos clave del mercado y de tus acciones.

### Vistas Disponibles

1. **Mis Eventos**: Muestra solo los eventos relacionados con las acciones que tienes actualmente en tu portafolio.
2. **Mercado**: Muestra eventos destacados del mercado general (ej. resultados de Apple, Microsoft, datos de inflación).

### Datos Mostrados

Para cada día con eventos, verás tarjetas con:
- **Tipo de Evento**: Resultados (Earnings), Dividendos, Reuniones Fed/BCE.
- **EPS Estimado**: Beneficio por acción esperado por los analistas.
- **Monto Dividendo**: Cantidad a pagar por acción.

### Sincronización

El sistema actualiza los datos automáticamente cada 6 horas. Puedes forzar una actualización manual pulsando el botón **"Sincronizar"**.

---

## ⚙️ Configuración de Perfil

### Datos Personales

1. Ve a **Perfil** en el menú lateral
2. En la pestaña **"General"** puedes:
   - Cambiar tu nombre
   - Cambiar tu email
   - Subir foto de perfil

### Cambiar Contraseña

1. Ve a **Perfil → Seguridad**
2. Introduce tu contraseña actual
3. Introduce la nueva contraseña (2 veces)
4. Haz clic en **"Cambiar Contraseña"**

### Gestionar 2FA

En **Perfil → Seguridad** puedes:

- **Activar 2FA** si no lo tienes
- **Cambiar modo de seguridad**:
  - *Estándar*: Contraseña + Código 2FA
  - *Reforzado*: Contraseña + Código 2FA + Código por Email
- **Regenerar códigos de respaldo**
- **Desactivar 2FA** (requiere contraseña y código actual)

### Preferencias

- **Idioma**: Español / Inglés
- **Moneda preferida**: EUR, USD, GBP...
 - **Tema**: Claro / Oscuro

### Búsqueda Global (v2.1.0)
Puedes navegar por la aplicación instantáneamente pulsando `Ctrl + K`.
- Escribe el nombre de una **pantalla** para ir a ella.
- Busca un **ticker** para ver su análisis.
- Busca una **cartera** para abrirla directamente.
- Usa `Enter` para viajar al destino seleccionado.

---

## ❓ Preguntas Frecuentes

### ¿Mis datos están seguros?

Sí. Usamos:
- Contraseñas hasheadas con bcrypt
- 2FA opcional con TOTP
- Conexiones HTTPS cifradas
- Base de datos aislada

### ¿De dónde vienen los precios?

Los datos de mercado provienen de **Yahoo Finance**, que ofrece precios con 15-20 minutos de retraso para la mayoría de mercados.

### ¿Puedo usar la app desde el móvil?

Sí. La interfaz es responsive y funciona en cualquier dispositivo con navegador.

### ¿Cómo recupero mi contraseña?

1. En la pantalla de login, haz clic en **"¿Olvidaste tu contraseña?"**
2. Introduce tu email
3. Recibirás una nueva contraseña temporal

### ¿Puedo tener varios portfolios?

Sí. Puedes crear tantos portfolios como necesites para organizar tus inversiones (largo plazo, trading, dividendos, etc.).

### ¿El ChatBot da consejos de inversión?

El ChatBot ofrece análisis y opiniones basadas en IA, pero **no son recomendaciones de inversión profesionales**. Siempre consulta con un asesor financiero antes de tomar decisiones importantes.

---

## 📞 Soporte

Si tienes problemas o sugerencias:

- Contacta con el administrador de tu instancia
- Revisa los logs de la aplicación

---

*Stocks Manager v2.1.0 - Gestión Inteligente de Inversiones*
