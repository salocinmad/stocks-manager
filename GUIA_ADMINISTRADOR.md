# 🛠️ Guía de Administrador - Stocks Manager

Versión 2.1.0 | Última actualización: Enero 2026

---

## 📑 Índice

1. [Instalación y Despliegue](#-instalación-y-despliegue)
2. [Panel de Administración](#-panel-de-administración)
3. [Gestión de Usuarios](#-gestión-de-usuarios)
4. [Configuración del Sistema](#-configuración-del-sistema)
5. [Claves API](#-claves-api)
6. [Configuración SMTP](#-configuración-smtp)
7. [Configuración de IA](#-configuración-de-ia)
8. [Sincronización de Mercado](#-sincronización-de-mercado)
9. [Backup y Restauración](#-backup-y-restauración)
10. [Panel de Análisis de Posición (v2.1.0)](#-panel-de-análisis-de-posición-v210)
11. [Alertas Avanzadas (v2.1.0)](#-alertas-avanzadas-v210)
12. [Atajos de Teclado (v2.1.0)](#️-atajos-de-teclado-v210)
13. [Monitorización](#-monitorización)

---

## 🐳 Instalación y Despliegue

### Requisitos

- Docker y Docker Compose
- 2GB RAM mínimo
- 10GB espacio en disco

### Despliegue con Docker Compose

```bash
# Clonar repositorio
git clone https://github.com/salocinmad/stocks-manager.git
cd stocks-manager

# Crear archivo de variables de entorno
cp server/env.example .env

# Editar variables (ver sección siguiente)
nano .env

# Desplegar
docker compose up -d --build
```

### Variables de Entorno (.env)

```bash
# Base de datos
DB_HOST=db
DB_PORT=5432
DB_NAME=stocks_manager
DB_USER=admin
DB_PASSWORD=tu_password_seguro

# JWT
JWT_SECRET=clave_secreta_muy_larga_y_segura

# APIs
FINNHUB_API_KEY=tu_clave_gratuita
# Opcionales (Solo para Google News vieja escuela, ahora obsoleta)
GOOGLE_API_KEY=

# SMTP (para emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu@email.com
SMTP_PASSWORD=app_password
SMTP_FROM=tu@email.com
```

### Acceso Inicial

1. Accede a `http://localhost:3000`
2. Regístrate con el primer usuario (se convierte en admin automáticamente)
3. Ve al panel de administración

---

## 🎛️ Panel de Administración

### Acceso

1. Inicia sesión con una cuenta de administrador
2. Haz clic en **"Admin"** en el menú lateral

### Pestañas Disponibles

| Pestaña | Función |
|---------|---------|
| **General** | Config URL, Crawlers y Toggle de Descubrimiento |
| **IA** | Configuración de Proveedores (Gemini, Ollama, etc) y Prompts |
| **Mercado** | Sincronización de datos históricos y Crawler Manual |
| **Usuarios** | Gestión de cuentas |
| **Claves API** | Configuración de Finnhub |
| **SMTP** | Configuración de email |
| **Backup** | Exportar/importar datos (ZIP/SQL) |
| **Estadísticas** | Métricas del sistema y Crawler |

---

## 👥 Gestión de Usuarios

### Listado de Usuarios

En la pestaña **Usuarios** verás:

| Columna | Descripción |
|---------|-------------|
| Usuario | Nombre y email |
| Rol | Admin o Usuario |
| Estado | Activo o Bloqueado |
| 2FA | Estado de autenticación 2FA |
| Registrado | Fecha de registro |
| Acciones | Botones de gestión |

### Acciones sobre Usuarios

| Acción | Icono | Descripción |
|--------|-------|-------------|
| Cambiar rol | 👤 | Alternar entre Admin y Usuario |
| Bloquear/Desbloquear | 🔒 | Impedir/permitir acceso |
| Cambiar contraseña | 🔑 | Establecer nueva contraseña |
| Eliminar | 🗑️ | Borrar usuario (irreversible) |
| Reset 2FA | 🔐 | Desactivar 2FA del usuario |
| Reset modo seguridad | 🛡️ | Cambiar a modo estándar |

### Bloquear Usuario

Cuando bloqueas un usuario:
- No puede iniciar sesión
- Sus datos se mantienen
- Puede ser desbloqueado después

### Resetear 2FA

Usa esta opción si un usuario:
- Perdió acceso a su app autenticadora
- Perdió los códigos de respaldo
- No puede entrar a su cuenta

Tras resetear, el usuario podrá configurar 2FA de nuevo.

---

## ⚙️ Configuración del Sistema

### Pestaña General

| Campo | Descripción |
|-------|-------------|
| **URL Pública** | URL donde está desplegada la app (ej: `https://stocks.tudominio.com`). Se usa en notificaciones por email. |

### Pestaña Discovery Engine (v2.1.0)

Control total sobre el comportamiento del crawler de mercado.

#### Presets (Modos Rápidos)
- **🐢 Stealth**: 2 ciclos/hora, bajo volumen. Para servidores con pocos recursos.
- **⚖️ Balanced**: 6 ciclos/hora (cada 10 min), volumen medio. Recomendado.
- **🐺 Wolf Mode**: 12 ciclos/hora (cada 5 min), alto volumen (80 items/worker). **Alto consumo de CPU/Red**.

#### Controles Granulares
- **Frecuencia de Ciclos**: Define cuántas veces por hora se ejecuta el crawler (1 a 30).
- **Volúmenes por Worker**:
    - **Yahoo V8 (Técnico)**: Cantidad de acciones a escanear buscando patrones técnicos.
    - **Yahoo V10 (Fundamental)**: Cantidad de acciones para análisis profundo de calidad.
    - **Finnhub (Noticias)**: Cantidad de acciones para buscar noticias recientes.
- **Priorizar Market Open**: Si está activo, detecta si la bolsa (US/EU) está abierta y fuerza la búsqueda de "Day Gainers" y "Most Actives" en lugar de la rotación habitual.

#### Arquitectura Split-World (v2.1.0)
El crawler ahora opera bajo un modelo de segmentación geográfica:
- **Pipeline USA**: Optimizado para mercados americanos usando Finnhub y Yahoo V10.
- **Pipeline Global**: Especializado en mercados Europeos y Asiáticos (ES, DE, FR, GB, HK) usando la API de trending de Yahoo.
- **Enriquecimiento**: Cualquier activo detectado sin sector se consulta automáticamente para completar su perfil.

#### Control Maestro (Kill Switch)
Ubicado en **Admin → General**. Si el interruptor principal está **OFF**, toda actividad del crawler se detiene, incluyendo las ejecuciones manuales por script.

#### Persistencia y Recolección Progresiva (v2.1.0)
El sistema utiliza una estrategia de **Merge/Append**. A diferencia de versiones anteriores, el motor no sobreescribe el catálogo en cada ciclo, sino que añade las nuevas empresas descubiertas a la base de datos existente. Esto asegura que el "Discovery Engine" actúe como una bola de nieve, creciendo constantemente en activos analizados.

#### Explorador de Mercado (v2.2.0 - Planificado)
Desde la pestaña **Estadísticas**, el administrador puede acceder a un explorador paginado para auditar cada activo procesado, realizar búsquedas por ticker y visualizar el objeto JSON completo con todas las métricas técnicas y fundamentales.

---

## 🔑 Claves API

### Finnhub

1. Obtén una API key en [finnhub.io](https://finnhub.io)
2. Ve a **Admin → Claves API**
3. Introduce tu key
4. Guarda

> 💡 Finnhub proporciona datos complementarios como noticias y métricas, pero ya **no es estrictamente necesario** para ver si el mercado está abierto (se usa Yahoo V10 por defecto).

### EOD Historical Data (EODHD) - Librería Global

1. Obtén una API key en [eodhd.com](https://eodhd.com/register)
2. Ve a **Admin → Claves API**
3. Introduce tu key en el campo **EODHD API Key**.
4. Configura el listado de bolsas en **Bolsas para Cosecha Global** (Ej: `MC,PA,LSE,NSE...`).
5. Guarda.

> 💡 **Librería Global**: El sistema utiliza EODHD para descargar la lista maestra de tickers mundiales con su ISIN. Esta lista alimenta al Discovery Engine para encontrar nuevas oportunidades fuera de USA.

### Google Gemini (IA)

1. Obtén una API key en [Google AI Studio](https://aistudio.google.com)
2. Ve a **Admin → Inteligencia Artificial**
3. Pega la key
4. Selecciona el modelo (recomendado: `gemini-1.5-flash`)
5. Guarda.

---

## 🌎 Librería Global de Tickers

### Configuración
Ubicada en **Admin → Mercado → Librería Global de Tickers**. 
Permite sincronizar de golpe miles de activos internacionales para que el sistema "conozca" su existencia antes de enriquecer su perfil.

> ⚠️ **Filtro de activos**: El sistema sincroniza exclusivamente **Acciones Comunes (Common Stock)**. Quedan excluidos automáticamente los ETFs, Fondos de Inversión y otros instrumentos financieros no deseados.

### Sincronización Automática
El sistema incluye un job interno (`globalTickerJob`) que se ejecuta el **día 1 de cada mes a las 02:00 AM** para mantener la librería actualizada con las nuevas salidas a bolsa (IPOs) y cambios de nombre.

### Sincronización Manual
Puedes forzar la actualización pulsando **"Iniciar Sincronización Mundial"**. 
> ⏳ **IMPORTANTE**: Debido a los límites de la cuenta gratuita de EODHD (20 créditos/día), el sistema espera **1 minuto** entre cada bolsa. La sincronización completa de las 20 bolsas principales tardará unos 20 minutos. El progreso se muestra en tiempo real en la pantalla.

---

## 🌍 Catálogo Maestro de Bolsas (v2.1.0)

Nueva funcionalidad para configurar qué bolsas mundiales alimentan el sistema de descubrimiento.

### Ubicación
**Admin → Mercado → Catálogo Maestro**

### Funcionalidades

| Función | Descripción |
|---------|-------------|
| **Lista de Bolsas** | 74+ bolsas mundiales obtenidas de la API de EODHD |
| **Búsqueda** | Filtrar por país, código o nombre |
| **Toggle Seleccionadas** | Ver solo las bolsas activas (click en badge "N seleccionadas") |
| **Caché Inteligente** | Lista se cachea 30 días para ahorrar créditos API |
| **Actualizar Lista** | Botón para forzar refresh desde EODHD |

### Códigos y Mapeo

El sistema mapea automáticamente los códigos EODHD a sufijos de Yahoo Finance:

| EODHD | Yahoo | Bolsa |
|-------|-------|-------|
| `NYSE` | (sin sufijo) | New York Stock Exchange |
| `NASDAQ` | (sin sufijo) | NASDAQ Stock Exchange |
| `AMEX` | (sin sufijo) | NYSE American |
| `US` | (sin sufijo) | USA genérico (no recomendado) |
| `LSE` | `.L` | London Stock Exchange |
| `XETRA` | `.DE` | Frankfurt Xetra |
| `MC` | `.MC` | Madrid Exchange |
| `PA` | `.PA` | Euronext Paris |
| `HK` | `.HK` | Hong Kong |
| `TSE` | `.T` | Tokyo Stock Exchange |

> 📁 **Archivo de mapeo**: `server/utils/exchangeMapping.ts` contiene 50+ bolsas mapeadas.

### Cosecha Mundial (Sincronización de Tickers)

El botón **"Iniciar Cosecha Mundial"** está disponible en dos ubicaciones:
- **Admin → Mercado → Sincronización** (sección Librería Global)
- **Admin → Mercado → Catálogo Maestro** (debajo del listado de bolsas)

Este botón:
1. Lee la configuración `GLOBAL_TICKER_EXCHANGES`
2. Conecta con EODHD API para cada bolsa seleccionada
3. Descarga todos los tickers (Common Stocks) con sus ISINs
4. Guarda/actualiza en la tabla `global_tickers`

> ⏱️ **Tiempo estimado**: ~1 minuto por bolsa para respetar límites de API.

### Limpieza Profunda Automática

Cuando **desmarcas** una bolsa del catálogo:

1. Se eliminan los tickers de esa bolsa de `global_tickers`
2. Se eliminan los detalles cacheados de `ticker_details_cache`
3. Se filtran los resultados del Discovery Engine (`market_discovery_cache`)

> ⚠️ **Advertencia**: Esta acción es irreversible para los datos de esa bolsa. Tendrás que volver a sincronizar si quieres recuperar esos tickers.

### Códigos Huérfanos

Si el sistema detecta códigos guardados que **ya no existen** en la lista de EODHD, mostrará un **banner de advertencia naranja**:

- Lista los códigos inválidos (ej: `T, HK, OS, LI`)
- Botón **"Limpiar códigos inválidos y datos"** que:
  - Elimina los códigos de la configuración
  - Ejecuta limpieza profunda de datos asociados
  - Guarda la configuración automáticamente

### Integración con Discovery Engine

El Discovery Job (`discoveryJob.ts`) ahora lee las regiones activas directamente de la configuración:

1. Lee `GLOBAL_TICKER_EXCHANGES` de `system_settings`
2. Convierte códigos EODHD a regiones (ej: `LSE` → `GB`)
3. Selecciona aleatoriamente una región para cada ciclo global
4. Si no hay configuración, usa regiones por defecto (DE, ES, GB, FR, IT, HK, AU)


---

## 📧 Configuración SMTP

Para que la app pueda enviar emails (alertas, códigos 2FA, etc.):

### Campos

| Campo | Ejemplo |
|-------|---------|
| Host | `smtp.gmail.com` |
| Puerto | `587` |
| Usuario | `tu@gmail.com` |
| Contraseña | Contraseña de aplicación |
| From | `noreply@tuapp.com` |

### Gmail

Si usas Gmail:
1. Activa la verificación en 2 pasos
2. Genera una [Contraseña de Aplicación](https://myaccount.google.com/apppasswords)
3. Usa esa contraseña en el campo SMTP

### Probar Configuración

1. Configura SMTP
2. Introduce tu email en "Email de prueba"
3. Haz clic en **"Enviar prueba"**
4. Verifica que recibes el email

---

## 🤖 Configuración de IA (Multi-Proveedor)

El sistema ahora soporta múltiples proveedores de IA, tanto en la nube como locales.

### 🧠 Proveedores Soportados

1.  **Google Gemini** (Nube - Default): Rápido y económico.
2.  **OpenRouter** (Nube): Acceso a Claude 3.5, GPT-4, Llama 3 via API unificada.
3.  **Groq** (Nube): Inferencia ultrarrápida (Llama 3, Mixtral).
4.  **Ollama** (Local): Privacidad total. Requiere correr Ollama en el servidor/PC.
5.  **LM Studio** (Local): Otra opción para LLMs locales.

### Configuración de Claves

Las claves API se gestionan en **Admin → Claves API** o mediante variables de entorno en el `.env`:

| Variable | Proveedor |
|----------|-----------|
| `GOOGLE_GENAI_API_KEY` | Google Gemini |
| `OPENROUTER_API_KEY` | OpenRouter |
| `GROQ_API_KEY` | Groq |

### Gestión de Modelos

1. Ve a **Admin → Inteligencia Artificial**.
2. Selecciona el **Proveedor Activo**.
3. Configura el **Modelo** específico (ej: `gemini-1.5-flash`, `anthropic/claude-3.5-sonnet`).
4. **Habilita/Deshabilita** proveedores según lo que quieras ofrecer a tus usuarios.

### 🎭 Prompts y Personas

Puedes crear y editar "Personas" para el ChatBot (ej: "Lobo de Wall Street", "Profesor", "Asesor Conservador").
- Ve a la sección **Prompts**.
- Edita el texto del prompt del sistema para cambiar la personalidad de la IA.
- Marca como **Activo** los que quieras que aparezcan en el selector del chat.

---

## 📈 Sincronización de Mercado (Layout Renovado)

La pestaña de **Mercado** ha sido reorganizada en un formato de **2 columnas** para mayor claridad y control.

### Columna Izquierda: Operaciones Diarias
Herramientas para la gestión habitual de datos.

1.  **Sincronización Manual**:
    - Periodos predefinidos (5 Días, 1 Mes, 1 Año...).
    - Botones para sincronizar **Todo**, solo **Acciones** o solo **Divisas**.
    - Incluye soporte nativo para `GBX` (Peniques) y tipos de cambio cruzados.

    - Herramienta para regenerar el historial de Ganancias/Pérdidas de todas las carteras si detectas inconsistencias en los gráficos.
3.  **Optimización de Estado de Mercado (v2.3.0)**:
    - El sistema implementa un **cache global de 60 segundos** para el estado de los mercados (Abierto/Cerrado).
    - Esto reduce drásticamente las llamadas a Yahoo Finance cuando hay múltiples usuarios conectados simultáneamente.

### Columna Derecha: Infraestructura Global
Herramientas avanzadas para la gestión del catálogo.

1.  **Librería Global (Cosecha)**:
    - Estado de la sincronización con EODHD (IPOs, cambios de ISIN).
    - Botón para iniciar la "Cosecha Mundial" (lento, respeta límites de API).

2.  **Enriquecimiento (V10)**:
    - Trigger manual para procesar activos descubiertos con datos fundamentales de Yahoo V10.

3.  **⛔ ZONA DE PELIGRO**:
    - **Borrar Datos Discovery**: Botón rojo para eliminar **TODOS** los datos del motor de descubrimiento (`global_tickers`, `market_discovery_cache`).
    - **Seguridad**: Requiere **DOBLE confirmación**:
      1. Click en el botón y aceptar el diálogo.
      2. Escribir la palabra clave `BORRAR` (en mayúsculas) en el segundo prompt.
    - *Úsalo solo si quieres reiniciar el catálogo desde cero.*

---

## 💾 Backup y Restauración

### Exportar Backup
 
 **Formato ZIP (Completo - Recomendado)**:
 1. Ve a **Admin → Backup → Manual**
 2. Haz clic en **"Descargar ZIP Completo"**
 3. Se descarga un archivo `.zip` que contiene:
    - `database_dump.json`: Todos los datos de la base de datos.
    - `uploads/`: Carpeta con imágenes, avatares y archivos subidos por los usuarios.
 
 **Formato SQL (Solo Estructura/Datos)**:
 1. Haz clic en **"Descargar SQL"**
 2. Genera un script SQL puro (útil para migraciones manuales o debug).

### 📅 Programador de Backups (Nuevo)

Ahora puedes automatizar el envío de copias de seguridad a tu correo electrónico.

1. Ve a **Admin → Backup → Programación**.
2. **Activar**: Enciende el interruptor "Habilitar Programador".
3. **Email**: Define la dirección de correo donde recibirás los backups.
4. **Frecuencia**:
   - **Diario**: Se envía todos los días a la hora configurada.
   - **Semanal**: Se envía un día específico de la semana (seleccionable: Lunes a Domingo).
   - **Mensual**: Se envía un día específico del mes (seleccionable: 1 al 28).
5. **Hora**: Selecciona la hora exacta de ejecución (Hora del Servidor).
6. **Protección**: (Opcional) Establece una contraseña para cifrar el archivo ZIP adjunto.
   > 🔒 Si configuras una contraseña, el ZIP no se podrá abrir sin ella.

**Limitaciones de Correo:**
- Si el backup supera los **25 MB**, no se adjuntará al correo.
- En su lugar, recibirás una notificación indicando que el backup se generó correctamente pero debes descargarlo manualmente desde el panel por motivos de tamaño.

**Prueba Inmediata:**
- Usa el botón **"Enviar Ahora"** para forzar una ejecución inmediata y verificar que recibes el correo correctamente.

### Restaurar Backup

> ⚠️ **CUIDADO**: Esto REEMPLAZA todos los datos actuales

1. Ve a **Admin → Backup → Manual**
2. Haz clic en **"Restaurar desde archivo"**
3. Selecciona tu archivo `.zip` (generado por el sistema), `.json` o `.sql`
4. Confirma la restauración
5. Cierra sesión y vuelve a entrar

### Recomendaciones

- Activa el **backup semanal** automatizado al correo.
- Usa contraseña para los backups por email si usas un servicio de correo público.
- Si tu instancia tiene muchas imágenes, es probable que superes los 25MB pronto; revisa tu correo para las notificaciones.

---

## 📊 Panel de Análisis de Posición (v2.1.0)

### Descripción

Nuevo modal grande (80% del viewport) que proporciona análisis profundo de cada posición. Accesible desde la pantalla de Cartera pulsando el icono 📊 (analytics) en cualquier posición.

### 6 Pestañas Disponibles

| Tab | Contenido |
|-----|-----------|
| **📈 Posición** | Cantidad, precio medio, PnL (€/%), peso en cartera |
| **📊 Técnico** | RSI (14), SMA 50, SMA 200, tendencia (alcista/bajista), timestamp último cálculo |
| **⚠️ Riesgo** | Volatilidad anualizada, Sharpe, Sortino, Max Drawdown, Beta, VaR, Score (1-10) |
| **🏢 Fundamental** | **NUEVO**: Valoración (PER, EV), Rentabilidad (ROE, Márgenes), Salud (Deuda), Dividendos |
| **🎯 Analistas** | Consenso (Comprar/Mantener/Vender), precio objetivo, desglose, insiders |
| **🔮 What-If** | Simulador interactivo: comprar más acciones, vender parcialmente, simular cambios de precio |

### Cálculos Automáticos y Caché

- **Técnico/Riesgo**: Job cada 6 horas.
- **Fundamental**: Caché de 14 días (debido a la baja frecuencia de cambios en reportes trimestrales).

### Lógica FIFO en Backend (v2.1.0)

El servicio `portfolioService.ts` implementa lógica FIFO estricta para:

| Función | Propósito |
|---------|-----------|
| `calculateFIFOQueue` | Construye cola de lotes de compra ordenados cronológicamente |
| `simulateSell` | Calcula coste base FIFO sin modificar BD (para previsualizaciones) |
| `recalculatePositionFromHistory` | Reconstruye una posición desde cero tras editar historial |

**API Nuevo**: `GET /portfolios/:id/positions/:ticker/simulate-sell?amount=X` devuelve el coste base FIFO para X acciones.

---

## 🔔 Alertas Avanzadas (v2.1.0)

### Nuevos Tipos de Alertas

| Tipo | Descripción |
|------|-------------|
| `price` | Alerta de precio (por encima/debajo de umbral) |
| `percent_change` | Cambio porcentual diario |
| `volume` | Volumen inusual (x veces el promedio) |
| `rsi` | **NUEVO**: Sobrecompra (RSI > 70) o Sobreventa (RSI < 30) |
| `sma_cross` | **NUEVO**: Golden Cross (SMA50 > SMA200) o Death Cross |

### Alertas de Portfolio

Ahora es posible crear alertas a nivel de cartera completa:

- **PnL absoluto**: Notificar si la ganancia/pérdida supera un umbral en €
- **PnL porcentual**: Notificar si el rendimiento supera un % objetivo
- **Valor total**: Notificar si el valor de la cartera alcanza un umbral
- **Exposición sectorial**: Notificar si un sector representa más del X% de la cartera

---

## ⌨️ Atajos de Teclado (v2.1.0)

### Hotkeys Disponibles

| Atajo | Acción |
|-------|--------|
| `Ctrl + K` | Abrir búsqueda global (Command Palette) |
| `Ctrl + D` | Ir a Dashboard |
| `Ctrl + P` | Ir a Cartera |
| `Ctrl + A` | Ir a Alertas |
| `Ctrl + W` | Ir a Watchlist |
| `Ctrl + N` | Nueva operación (Registrar compra/venta) |
| `?` | Mostrar panel de ayuda de atajos |
| `Escape` | Cerrar modal activo |

### Búsqueda Global (Ctrl+K)

La búsqueda global permite navegar rápidamente por la aplicación:

- **Pantallas**: Dashboard, Cartera, Alertas, Noticias, etc.
- **Tickers**: Busca acciones por nombre o símbolo
- **Carteras**: Accede a tus carteras directamente

Usa las flechas ↑↓ para navegar y Enter para seleccionar.

## 📊 Monitorización

### Estadísticas del Sistema

En **Admin → Estadísticas** puedes ver:

| Métrica | Descripción |
|---------|-------------|
| Usuarios totales | Número de cuentas registradas |
| Usuarios bloqueados | Cuentas bloqueadas |
| Portfolios | Total de carteras |
| Posiciones | Número de posiciones activas |
| Transacciones | Operaciones registradas |

### Logs

Los logs del contenedor se pueden ver con:

```bash
docker logs stocks_app
docker logs stocks_app --tail 100 -f  # Últimas 100 líneas en tiempo real
```

### Verificar Estado

```bash
# Ver contenedores
docker ps

# Ver recursos
docker stats
```

---

## 🔧 Solución de Problemas

### La app no arranca

1. Verifica logs: `docker logs stocks_app`
2. Comprueba que PostgreSQL está healthy: `docker ps`
3. Revisa variables de entorno en `.env`

### No llegan emails

1. Verifica configuración SMTP
2. Prueba con "Enviar prueba"
3. Revisa logs para errores de conexión
4. Si usas Gmail, verifica la contraseña de aplicación

### Datos de mercado no se actualizan

1. Ve a Admin → Mercado
2. Ejecuta sincronización manual
3. Verifica conectividad con Yahoo Finance

### Usuario no puede entrar (2FA)

1. Ve a Admin → Usuarios
2. Busca al usuario
3. Haz clic en "Reset 2FA" (icono llave)
4. El usuario podrá entrar y reconfigurar 2FA

### Base de datos corrupta

1. Para la app: `docker compose stop app`
2. Restaura un backup previo
3. Reinicia: `docker compose up -d`

---

## 🔒 Seguridad

### Recomendaciones

- ✅ Usa HTTPS con certificado SSL
- ✅ Cambia las contraseñas por defecto
- ✅ Activa 2FA para todos los admins
- ✅ Limita acceso por IP si es posible
- ✅ Haz backups regulares
- ✅ Mantén Docker actualizado

### Primer Admin

El primer usuario registrado se convierte automáticamente en admin. Después:
- Solo un admin puede crear otros admins
- No se puede eliminar el último admin

---

*Stocks Manager v2.1.0 - Guía de Administrador*

---

## 🧪 Ejecución de Tests

El sistema incluye una suite de pruebas automatizadas.

### Cómo ejecutar los tests

```bash
docker compose exec app npm test
```

### Interpretación

1.  **✅ CHECKS VERDES (Pasados)**: Aparecen **al principio**.
2.  **❌ FALLOS ROJOS (Fallidos)**: Aparecen **al final**.

> **Nota Importante**: En la terminal NO verás el "stack trace" (detalle técnico) del error. Solo verás qué test falló.

Para ver el detalle completo (línea de código, diferencia de variables, etc.), el sistema genera automáticamente un fichero de log:

`server/tests/test_debug.log`

Si hay fallos, el test runner te recordará esta ruta al finalizar.
