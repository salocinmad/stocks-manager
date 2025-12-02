# 📖 Guía de Usuario

Guía completa para usar las características de Stocks Manager.

---

## 📋 Tabla de Contenidos

- [Primeros Pasos](#primeros-pasos)
- [Gestión de Carteras](#gestión-de-carteras)
- [Gestión de Posiciones](#gestión-de-posiciones)
- [Informes y Análisis](#informes-y-análisis)
- [Configuración](#configuración)
- [Características Avanzadas](#características-avanzadas)

---

## 🚀 Primeros Pasos

### Primer Inicio de Sesión

1. Navega a http://localhost:3000
2. Introduce tus credenciales:
   - **Usuario**: `admin`
   - **Contraseña**: `admin123`
3. Haz clic en **Iniciar Sesión**

> **💡 Consejo**: Cambia tu contraseña después del primer inicio en **Panel Admin** → **Cambiar Contraseña**

### Comprender la Interfaz

**Componentes Principales:**
- **Navegación Superior**
  - Toggle de tema (🌙/☀️)
  - Toggle de vista histórica
  - Panel admin (icono engranaje ⚙️)
  - Botones Comprar/Vender
  - Menú de usuario

- **Selector de Cartera**
  - Desplegable para cambiar entre carteras
  - Menú de cartera (📁) para gestión

- **Panel Principal**
  - Resumen de cartera (valor total, PnL de hoy)
  - Lista de posiciones activas
  - Actualizaciones rápidas de precios

---

## 📊 Gestión de Carteras

### Crear una Cartera

1. Haz clic en el **desplegable de Cartera** (junto a tu nombre de usuario)
2. Selecciona **Menú de Cartera** (icono 📁)
3. Haz clic en **Crear Nueva Cartera**
4. Introduce:
   - **Nombre**: Nombre descriptivo (ej: "Jubilación", "Trading")
5. Haz clic en **Crear**

### Cambiar de Cartera

1. Haz clic en el **desplegable de Cartera**
2. Selecciona la cartera que quieres ver
3. La página se recarga con los datos de la cartera seleccionada

### Establecer Cartera Favorita

1. Abre **Menú de Cartera** (📁)
2. Haz clic en el **icono de estrella** (⭐) junto a una cartera
3. Esta cartera se cargará automáticamente al iniciar sesión

### Renombrar una Cartera

1. Abre **Menú de Cartera** (📁)
2. Haz clic en el **icono de editar** (✏️) junto a la cartera
3. Introduce el nuevo nombre
4. Haz clic en **Guardar**

### Eliminar una Cartera

1. Abre **Menú de Cartera** (📁)
2. Haz clic en el **icono de eliminar** (🗑️) junto a la cartera
3. **Confirma** la eliminación

> **⚠️ ADVERTENCIA**: Eliminar una cartera borra TODAS las operaciones, posiciones y datos históricos. ¡Esta acción no se puede deshacer!

---

## 💼 Gestión de Posiciones

### Comprar una Acción

1. Haz clic en el botón **Comprar** en el encabezado
2. **Buscar Empresa**:
   - Escribe el nombre de la empresa o símbolo (ej: "Apple" o "AAPL")
   - Selecciona de los resultados del desplegable
3. **O Introducir Símbolo Externo**:
   - Haz clic en la pestaña **Símbolo Externo**
   - Introduce el símbolo de Yahoo Finance manualmente (ej: "AAPL", "SAN.MC")
4. Completa los detalles de la operación:
   - **Acciones**: Número de acciones compradas
   - **Precio**: Precio de compra por acción
   - **Divisa**: EUR o USD
   - **Fecha**: Fecha de compra (por defecto hoy)
   - **Tipo de Cambio**: Auto-completado si usas USD (puedes ajustar manualmente)
5. Haz clic en **Guardar**

### Vender una Acción

1. Haz clic en el botón **Vender** en el encabezado
2. **Seleccionar Posición**: Elige de qué posición vender
3. Completa los detalles de la operación:
   - **Acciones**: Número de acciones a vender
   - **Precio**: Precio de venta por acción
   - **Divisa**: Igual que la divisa de compra o convertir
   - **Fecha**: Fecha de venta
4. Haz clic en **Guardar**

> **💡 Nota**: La venta usa el método FIFO (First In, First Out) para el cálculo de la base de coste.

### Ver Detalles de Posición

Haz clic en cualquier posición en la lista para **expandirla** y ver:
- **Historial de Operaciones**: Todas las transacciones de compra/venta
- **Gráfico Histórico**: Evolución del precio con velas OHLC
- **Resumen de Rendimiento**: Total invertido, valor actual, PnL
- **Notas**: Anotaciones personales (haz clic en el icono de lápiz para editar)

### Actualizar Precios

**Actualización Manual:**
1. Haz clic en el botón **🔄 Actualizar Precios**
2. Espera hasta completar (muestra estado "Actualizando...")
3. Los precios se refrescan automáticamente

**Actualizaciones Automáticas:**
- Se ejecuta cada 15 minutos por defecto
- Configurable en **Panel Admin** → **Configuración**

### Establecer Precio Objetivo

1. Expande una posición
2. Haz clic en el botón **Establecer Objetivo**
3. Introduce tu precio objetivo
4. Guardar

> **📧 Nota**: Las notificaciones por correo requieren configuración SMTP en el Panel Admin.

---

## 📈 Informes y Análisis

Accede a informes haciendo clic en **Informes** en el menú de navegación.

### Resumen de Cartera

**Sección Actual:**
- Valor total de cartera
- PnL de hoy (absoluto y porcentaje)
- Recuento de posiciones activas
- Monto total invertido

### Análisis de Rendimiento

**Gráfico PnL:**
- Evolución histórica de ganancias/pérdidas
- Vistas diaria, semanal, mensual
- Funcionalidad de zoom y paneo

**Calendario de Calor:**
- Rentabilidades diarias visualizadas como mapa de calor
- Verde = día positivo, Rojo = día negativo
- Pasa por encima para porcentajes exactos

**Gráfico de Drawdown:**
- Visualización de pérdida máxima desde el pico
- Identifica los peores períodos
- Muestra patrones de recuperación

### Análisis de Asignación

**Por Sector:**
- Gráfico circular mostrando distribución por sector
- Basado en clasificación de sector de Yahoo Finance
- Ayuda a identificar riesgo de concentración

**Por Industria:**
- Más granular que sectores
- Porcentajes de asignación por industria

**Por Posición:**
- Pesos de acciones individuales en la cartera
- Ordenado por valor

### Métricas de Riesgo

**Beta de Cartera:**
- Mide volatilidad vs mercado
- Beta > 1 = Más volátil que el mercado
- Beta < 1 = Menos volátil que el mercado

**Ratio de Sharpe:**
- Medida de rentabilidades ajustadas por riesgo
- Cuanto más alto, mejor

**Drawdown Máximo:**
- Mayor caída de pico a valle
- Importante para gestión de riesgo

### Análisis Mensual

- Desglose de rendimiento mes a mes
- PnL Realizado vs No Realizado
- Excluye mes actual (datos incompletos)

### Exportar a PDF

1. Desplázate a la parte superior de la página de Informes
2. Haz clic en el botón **📄 Exportar PDF**
3. Espera la generación
4. El PDF se descarga automáticamente con la fecha actual

---

## ⚙️ Configuración

### Configuración de Usuario

**Foto de Perfil:**
1. Haz clic en tu **nombre de usuario** en el encabezado
2. Selecciona **Cambiar Foto de Perfil**
3. Sube una imagen (JPG, PNG, GIF)
4. Recorta si lo deseas
5. Guardar

**Cambiar Contraseña:**
1. Abre **Panel Admin** (icono engranaje)
2. Haz clic en **Cambiar Contraseña**
3. Introduce contraseña actualIntroduce nueva contraseña (mínimo 6 caracteres)
5. Confirma nueva contraseña
6. Guardar

### Panel de Administración (Solo Usuarios Admin)

**Acceso**: Icono engranaje (⚙️) → **Panel de Administración**

#### Pestaña Configuración

**Clave API Finnhub:**
- Clave gratuita de https://finnhub.io/
- Mejora la fiabilidad de los datos de precios
- Opcional (Yahoo Finance funciona sin ella)

**Nivel de Log:**
- **Info**: Logging normal (recomendado)
- **Verbose**: Logging detallado (para depuración)

**Configuración de Programación:**
- Configurar frecuencia de actualización de precios
- Hora del snapshot diario

#### Gestión de Precios

**Sobrescribir Datos Históricos:**
- Redescarga todos los datos históricos de precios
- Útil si los datos están corruptos o incompletos
- **Usar con precaución**: Lleva tiempo y peticiones API

**Recalcular Todos los Cierres Diarios:**
- Recalcula estadísticas diarias de cartera
- Corrige problemas de cálculo de PnL
- Seguro ejecutar en cualquier momento

#### Configuración SMTP

Configurar notificaciones por correo:
1. Introduce **Host SMTP** (ej: smtp.gmail.com)
2. Introduce **Puerto SMTP** (587 para TLS, 465 para SSL)
3. Introduce **Usuario SMTP** (tu correo)
4. Introduce **Contraseña SMTP** (contraseña de aplicación, no contraseña regular)
5. Selecciona opción **Segura** (TLS recomendado)
6. Guardar

> **Usuarios de Gmail**: Genera una **Contraseña de Aplicación** en https://myaccount.google.com/apppasswords

---

## 🎯 Características Avanzadas

### Botones de Enlaces Externos

Personaliza enlaces rápidos a herramientas externas:

1. Haz clic en tu **nombre de usuario** → **Enlaces Externos**
2. Añade botones para:
   - Gráficos de TradingView
   - Páginas de Yahoo Finance
   - Sitios web de brokers
   - etc.
3. Usa marcadores de posición:
   - `{symbol}` - Reemplazado con símbolo de acción
   - `{company}` - Reemplazado con nombre de empresa

Ejemplo:
```
Texto del Botón: Ver en TradingView
URL: https://www.tradingview.com/symbols/{symbol}
```

### Ordenamiento de Posiciones

Personaliza el orden de posiciones en tu lista:

1. Pasa el ratón sobre una posición
2. Haz clic y mantén presionado el **icono de arrastre** (⋮⋮)
3. Arrastra a la posición deseada
4. Suelta

El orden se guarda automáticamente y persiste entre sesiones.

### Notas

Añade notas personales a cualquier posición:

1. Expande una posición
2. Haz clic en el **icono de lápiz** (✏️) junto a "Notas"
3. Escribe tu nota (soporta texto multi-línea)
4. Haz clic en **Guardar**

Casos de uso:
- Tesis para comprar
- Recordatorios para revisar
- Noticias importantes
- Estrategia de salida

### Vista Histórica

Toggle de gráficos históricos de acciones:

1. Haz clic en el botón **Vista Histórica** en el encabezado
2. Los gráficos aparecen bajo cada posición expandida
3. Características:
   - Datos de velas OHLC
   - Barras de volumen
   - Zoom y paneo
   - Rango de fechas personalizable

---

## 💡 Consejos y Mejores Prácticas

### Actualizaciones de Precios

- **No actualizar en exceso**: La programación por defecto de 15 minutos suele ser suficiente
- **Horario de mercado**: Las actualizaciones son más útiles durante horario de mercado
- **Límites API**: Finnhub tiene límites de tasa (60 llamadas/minuto en plan gratuito)

### Organización de Carteras

- **Usa nombres descriptivos**: "Crecimiento Tech", "Ingresos por Dividendos", etc.
- **Separa estrategias**: Crea diferentes carteras para trading vs largo plazo
- **Favorita tu cartera principal**: Se carga automáticamente al iniciar sesión

### Precisión de Datos

- **Verifica símbolos**: Asegúrate de usar el símbolo correcto de Yahoo Finance
- **Verifica precios**: Compara con tu broker para asegurar precisión
- **Actualiza tipos de cambio**: Ajusta manualmente si la tasa automática es incorrecta

### Seguimiento de Rendimiento

- **Usa precios objetivo**: Establece objetivos realistas según tu estrategia
- **Revisa mensualmente**: Verifica la sección de Análisis Mensual regularmente
- **Monitorea drawdowns**: Ten conciencia de escenarios de peor caso

### Seguridad

- **Cambia contraseña por defecto**: Después del primer inicio de sesión
- **Usa contraseñas fuertes**: Mínimo 12 caracteres recomendado
- **Backups regulares**: Exporta tus datos periódicamente

---

**¿Necesitas Ayuda?** Ver [SOLUCION_PROBLEMAS.md](SOLUCION_PROBLEMAS.md) para problemas comunes y soluciones.
