# 📖 Guía de Usuario - Stocks Manager

Esta guía completa te enseñará a usar todas las funcionalidades de Stocks Manager para gestionar tus inversiones de forma profesional.

---

## 📑 Índice

1. [Primeros Pasos](#-primeros-pasos)
2. [Gestión de Portafolios](#-gestión-de-portafolios)
3. [Operaciones de Compra y Venta](#-operaciones-de-compra-y-venta)
4. [Dashboard y Análisis](#-dashboard-y-análisis)
5. [Gráficos y Visualizaciones](#-gráficos-y-visualizaciones)
6. [Alertas y Notificaciones](#-alertas-y-notificaciones)
7. [Personalización](#-personalización)
8. [Notas y Organización](#-notas-y-organización)

---

## 🚀 Primeros Pasos

### Crear tu Cuenta

1. Accede a la aplicación en tu navegador (`http://localhost` o tu dominio configurado)
2. En la pantalla de login, haz clic en **"Registrarse"**
3. Introduce tu usuario y contraseña (mínimo 6 caracteres)
4. ¡Listo! Ya puedes empezar a usar Stocks Manager

### Primer Inicio de Sesión

Al iniciar sesión por primera vez:
- Se creará automáticamente tu **Portafolio Principal**
- Verás el dashboard vacío (sin operaciones aún)
- Puedes empezar a añadir operaciones inmediatamente

---

## 💼 Gestión de Portafolios

### ¿Qué es un Portafolio?

Un portafolio es una cartera de inversión independiente. Puedes crear varios portafolios para:
- Separar inversiones a largo plazo de trading
- Organizar inversiones por estrategia
- Diferenciar inversiones en diferentes brokers
- Cualquier otra clasificación que prefieras

### Crear un Nuevo Portafolio

1. Haz clic en el **menú de portafolio** (junto al nombre del portafolio actual)
2. Selecciona **"Crear Portafolio"**
3. Introduce el nombre (ej: "Trading", "Dividendos", "Acciones USA")
4. El nuevo portafolio se crea vacío y listo para usar

### Cambiar entre Portafolios

1. Haz clic en el **selector de portafolio** en la parte superior
2. Selecciona el portafolio que deseas ver
3. El dashboard se actualiza automáticamente con los datos de ese portafolio

### Marcar Portafolio como Favorito

1. Abre el **menú de portafolio**
2. Haz clic en la ⭐ junto al portafolio que quieres marcar como favorito
3. Este portafolio se cargará automáticamente al iniciar sesión

### Renombrar un Portafolio

1. Abre el **menú de portafolio**
2. Haz clic en **"Renombrar"** junto al portafolio
3. Introduce el nuevo nombre
4. Confirma el cambio

### Eliminar un Portafolio

1. Abre el **menú de portafolio**
2. Haz clic en **"Eliminar"** (⚠️ solo disponible si el portafolio está vacío)
3. Confirma la eliminación

> **Nota**: No puedes eliminar un portafolio que tenga operaciones. Debes borrar todas las operaciones primero.

---

## 📈 Operaciones de Compra y Venta

### Registrar una Compra

1. Haz clic en el botón **"Comprar"** en la barra superior
2. **Buscar la empresa**:
   - Escribe el nombre de la empresa (ej: "Apple", "Microsoft")
   - Selecciona de los resultados
   - O introduce manualmente el símbolo (ej: "AAPL")
3. **Rellenar datos**:
   - **Fecha**: Fecha de la operación
   - **Acciones**: Número de acciones compradas
   - **Precio**: Precio por acción
   - **Comisión**: Comisión del broker (opcional)
   - **Divisa**: USD o EUR (se detecta automáticamente)
4. Haz clic en **"Guardar"**

### Registrar una Venta

1. Haz clic en el botón **"Vender"** en la barra superior
2. **Seleccionar posición**:
   - Elige la acción que quieres vender de tu lista de posiciones activas
   - O busca manualmente si ya no la tienes en cartera
3. **Rellenar datos**:
   - **Fecha**: Fecha de la operación
   - **Acciones**: Número de acciones vendidas
   - **Precio**: Precio de venta por acción
   - **Comisión**: Comisión del broker (opcional)
4. Haz clic en **"Guardar"**

### Búsqueda de Empresas

La búsqueda utiliza **Finnhub** para encontrar empresas:
- Escribe al menos 2 letras del nombre
- Aparecen resultados con:
  - Nombre de empresa
  - Símbolo (ticker)
  - Exchange (mercado)
- Selecciona la empresa correcta

#### Símbolos Externos

Si la empresa no aparece en Finnhub:
1. Marca **"Símbolo Externo"**
2. Introduce manualmente:
   - Símbolo (ej: "SAN.MC" para Santander Madrid)
   - Exchange (ej: "BME", "MC")
3. Stocks Manager intentará obtener precios desde Yahoo Finance

### Editar una Operación

1. En el historial de operaciones, haz clic en **"Editar"** junto a la operación
2. Modifica los campos necesarios
3. Guarda los cambios

### Eliminar una Operación

1. En el historial de operaciones, haz clic en **"Eliminar"**
2. Confirma la eliminación
3. Las estadísticas se recalculan automáticamente

---

## 📊 Dashboard y Análisis

### Tarjeta de Resumen del Portafolio

La tarjeta principal muestra:

#### Métricas Principales
- **Total Invertido**: Suma de todas las compras en EUR
- **Valor Actual**: Valor de mercado de tus posiciones
- **PnL (Profit and Loss)**: Ganancia o pérdida total (color verde/rojo)
- **PnL %**: Porcentaje de rendimiento

#### Métricas Avanzadas
- **ROI Realizado**: Return on Investment de operaciones cerradas
- **Win Rate**: % de operaciones cerradas en beneficio
- **Tiempo Medio**: Días promedio de tenencia de posiciones cerradas
- **Best Trade**: Mayor ganancia en una operación
- **Worst Trade**: Mayor pérdida en una operación

### Posiciones Activas

Lista de todas tus acciones actuales con:
- **Empresa y Símbolo**
- **Acciones**: Cantidad que posees
- **Precio Medio**: Precio promedio de compra
- **Precio Actual**: Último precio conocido (con badge de fuente: Cache/Finnhub/Yahoo)
- **Valor**: Valor actual de la posición
- **PnL**: Ganancia/pérdida de esta posición

#### Expansión de Posición

Haz clic en una posición para ver:
- **Historial de Operaciones**: Todas las compras/ventas de este activo
- **Gráfico Histórico**: Evolución del precio (velas OHLC)
- **Alertas**: Configura precios objetivo
- **Notas**: Añade recordatorios o análisis

### Vista Histórica

Activa el botón **"Vista Histórica"** para ver:
- Estado de tu cartera en fechas pasadas
- Evolución del PnL en el tiempo
- Comparativa de rendimiento mensual

---

## 📉 Gráficos y Visualizaciones

### Gráfico de Distribución (Pie Chart)

Muestra la distribución de tu cartera por activo:
- **% de cartera** de cada acción
- **Valor en EUR** de cada posición
- Colores distintivos para cada activo
- Hover para ver detalles

> **Alerta**: Si un activo representa >30% de tu cartera, verás un aviso de concentración.

### Gráfico de Evolución del PnL

Visualiza la evolución histórica de tu cartera:
- **Eje X**: Fechas (últimos 30-90 días)
- **Eje Y**: PnL en EUR
- **Línea**: Evolución del beneficio/pérdida
- **Colores**: Verde (ganancia) / Rojo (pérdida)

### Gráfico de Velas (OHLC) por Acción

Al expandir una posición, verás:
- **Velas japonesas** con Open, High, Low, Close
- **Zoom**: Acerca/aleja con la rueda del ratón
- **Tipos de gráfico**: Velas o línea
- **Períodos**: 1 mes, 3 meses, 6 meses, 1 año

---

## 🔔 Alertas y Notificaciones

### Configurar Alerta de Precio Objetivo

1. Expande una posición activa
2. Haz clic en **"Configurar Alerta"**
3. Introduce el **precio objetivo**
4. Guarda la alerta

Cuando el precio alcance el objetivo:
- Recibirás un **email** (si SMTP está configurado)
- Verás un **aviso** en el dashboard
- La alerta se marca como disparada (puedes reactivarla desde Admin)

### Alertas Automáticas

Stocks Manager genera alertas automáticas para:

#### Pérdida Significativa
- Se dispara si una posición pierde >15%
- Aparece en el dashboard con icono ⚠️

#### Riesgo de Concentración
- Se activa si un activo representa >30% de tu cartera
- Recomendación de diversificación

#### Objetivo Alcanzado
- Cuando un precio objetivo se alcanza
- Email automático (requiere configuración SMTP en Admin)

---

## 🎨 Personalización

### Cambiar Tema (Claro/Oscuro)

1. Haz clic en el icono de **tema** (☀️/🌙) en la barra superior
2. El tema cambia inmediatamente
3. La preferencia se guarda automáticamente

### Foto de Perfil

1. Haz clic en tu **inicial** (círculo en la esquina superior derecha)
2. Selecciona **"Cambiar foto de perfil"**
3. Sube una imagen (JPG, PNG, max 2MB)
4. La foto se muestra en lugar de la inicial

### Botones Externos

Añade enlaces rápidos a tus plataformas favoritas:

1. Haz clic en tu **inicial** → **"Botones Externos"**
2. Haz clic en **"Añadir Botón"**
3. Rellena:
   - **Nombre**: Ej: "Yahoo Finance"
   - **URL**: Ej: `https://finance.yahoo.com/quote/{SYMBOL}`
   - **Icono**: Emoji o texto corto
4. Usa `{SYMBOL}` en la URL para que se reemplace automáticamente

Ejemplo:
- Nombre: `Yahoo Finance`
- URL: `https://finance.yahoo.com/quote/{SYMBOL}`
- Icono: `📈`

Al hacer clic, se abrirá Yahoo Finance con el símbolo de la posición seleccionada.

### Cambiar Contraseña

1. Haz clic en tu **inicial** → **"Cambiar contraseña"**
2. Introduce tu contraseña actual
3. Introduce la nueva contraseña (mínimo 6 caracteres)
4. Confirma y guarda

---

## 📝 Notas y Organización

### Añadir Notas a Posiciones

1. Expande una posición activa
2. Haz clic en **"Añadir Nota"** o en el icono 📝
3. Escribe tu nota (soporta Markdown básico):
   - `**negrita**` para **negrita**
   - `*cursiva*` para *cursiva*
   - `[enlace](URL)` para enlaces
4. Guarda la nota

Las notas son útiles para:
- Recordar por qué compraste una acción
- Anotar objetivos de precio
- Guardar análisis o noticias relevantes
- Cualquier información que quieras recordar

### Ordenar Posiciones

1. Arrastra y suelta las posiciones en el orden que prefieras
2. El orden se guarda automáticamente
3. Se mantiene entre sesiones

---

## 📄 Reportes

### Visualizar Reportes

1. Haz clic en **"Reportes"** en la barra superior
2. Verás 3 tipos de reportes:

#### Reporte Diario
- Generado automáticamente cada noche
- Snapshot del estado de tu cartera
- Métricas del día

#### Reporte Mensual
- Generado al final de cada mes
- Resumen de operaciones del mes
- Comparativa con meses anteriores

#### Reporte Anual
- Generado al final del año
- Consolidación anual completa
- Análisis de rendimiento anual

### Exportar Reportes

> **Próximamente**: Exportación a PDF

---

## 🔧 Consejos y Mejores Prácticas

### Registro de Operaciones

✅ **Hazlo**: Registra las operaciones lo antes posible
❌ **Evita**: Esperar semanas para registrar operaciones antiguas

### Diversificación

✅ **Hazlo**: Mantén una cartera diversificada (<30% por activo)
❌ **Evita**: Concentrar >50% en una sola empresa

### Revisión Periódica

✅ **Hazlo**: Revisa tus posiciones semanalmente
✅ **Hazlo**: Actualiza tus alertas de precio objetivo
✅ **Hazlo**: Lee los reportes mensuales

### Backup

✅ **Hazlo**: Si eres administrador, haz backups mensuales
✅ **Hazlo**: Guarda los backups en un lugar seguro

---

## ❓ Preguntas Frecuentes

### ¿Puedo usar Stocks Manager en mi móvil?

Sí, la interfaz es responsive. Funciona en tablets y móviles, aunque la experiencia es mejor en desktop.

### ¿Stocks Manager compra o vende acciones por mí?

No. Stocks Manager es solo una herramienta de **seguimiento y análisis**. No ejecuta operaciones reales.

### ¿Qué APIs usa para obtener precios?

- **Finnhub**: Búsqueda de empresas y precios en tiempo real
- **Yahoo Finance**: Datos históricos, divisas y cierre de mercado

### ¿Los precios son en tiempo real?

- En mercado abierto: Sí (con Finnhub, delay de ~1 minuto según plan)
- En mercado cerrado: Se usa el último precio conocido

### ¿Puedo gestionar acciones de diferentes países?

Sí. Stocks Manager soporta:
- Mercados USA (NASDAQ, NYSE)
- Mercados europeos (BME Madrid, XETRA Frankfurt, LSE Londres)
- Conversión automática de USD a EUR

### ¿Cómo se calcula el PnL?

**PnL = Valor Actual - Total Invertido**

- **Valor Actual**: Precio actual × Número de acciones (convertido a EUR)
- **Total Invertido**: Suma de todas las compras (incluidas comisiones)

---

## 🆘 Problemas Comunes

### No aparecen los precios actuales

1. Verifica que tienes conexión a internet
2. Comprueba que la API Key de Finnhub está configurada (Panel Admin)
3. Revisa que el símbolo es correcto

### Mi empresa no aparece en la búsqueda

1. Usa **"Símbolo Externo"**
2. Introduce el símbolo de Yahoo Finance (ej: `SAN.MC` para Santander)
3. Stocks Manager obtendrá precios desde Yahoo

### El gráfico histórico no carga

1. Asegúrate de que hay datos históricos (al menos 7 días desde la compra)
2. Comprueba que Yahoo Finance tiene datos para ese símbolo
3. Si el símbolo es incorrecto, edita la operación y corrige el símbolo

---

**¿Más dudas?** Consulta la [Guía de Administración](./ADMINISTRACION.md) o abre un issue en GitHub.

**¡Feliz inversión!** 🚀📈
