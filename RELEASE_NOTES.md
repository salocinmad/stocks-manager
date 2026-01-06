# 🚀 Stocks Manager v2.1.0 Release Notes
## "The Autonomous Intelligence Update"

Esta versión transforma la plataforma de un gestor pasivo a un **sistema inteligente de descubrimiento y análisis**.

---

## ✨ Principales Novedades

### 🧠 Motor de IA Multi-Proveedor
- **Proveedores**: Gemini, OpenRouter (Claude, GPT-4), Groq, Ollama, LM Studio
- **Configuración Dinámica**: Añade/cambia proveedores desde Admin sin reiniciar
- **Prompts Contextuales**: La IA recibe noticias, datos fundamentales y técnicos

### 🦁 Discovery Engine (Crawler v2)
- **Arquitectura Split-World**: Pipelines separados USA (Finnhub) vs Global (Yahoo Trending)
- **Control Granular**: Presets (Sigilo/Balanceado/Wolf) + sliders hasta 80 items
- **Kill Switch**: Control maestro para activar/desactivar el crawler completo
- **Marcado de Fallidos**: Los tickers incompatibles con Yahoo se marcan para saltar en futuros ciclos

### 🌎 Catálogo Maestro de Tickers
- **Sincronización EODHD**: +100.000 activos con ISIN universal
- **Filtro "Solo Acciones"**: Ignora ETFs, Fondos e instrumentos irrelevantes
- **Job Mensual**: Actualización automática de 20 bolsas principales

### 📊 Panel de Análisis de Posición
- **5 Pestañas**: Posición, Técnico, Riesgo, Analistas, What-If
- **Métricas de Riesgo**: Sharpe, Sortino, VaR 95%, Max Drawdown, Beta
- **Cálculos Automáticos**: Job cada 6 horas precalcula métricas

### 🔔 Alertas Avanzadas
- **Técnicas**: RSI (sobrecompra/sobreventa), Cruces SMA (Golden/Death Cross)
- **Portfolio**: PnL absoluto/porcentual, valor total, exposición sectorial
- **Multi-idioma**: Alertas de noticias en ES/EN

---

## 🖥️ Mejoras de Interfaz

### Panel de Administración Reorganizado
- **Tab Mercado** con 3 subtabs:
  - **Sincronización**: Sync manual, PnL, Librería Global, Zona de Peligro
  - **Índices de Cabecera**: Selector de índices para la cabecera global
  - **Discovery Engine**: Control maestro y configuración granular

### Dashboard Premium
- **Skeleton Loading**: Carga progresiva sin spinners bloqueantes
- **Selector de Portafolio**: Dropdown estilo glassmorphism
- **Top Movers**: Widgets de Mejores/Peores del día

### Navegación
- **Sidebar 2.0**: Agrupación lógica + estética glassmorphism
- **Breadcrumbs**: Navegación jerárquica
- **Atajos**: `Ctrl+K` (búsqueda), `Ctrl+D/P/A/W` (navegación)

### Sistema de Notificaciones
- **Toasts**: Reemplazo de `alert()` por notificaciones elegantes

---

## 📈 Datos y Análisis

### Datos Fundamentales Profundos
- **Valoración**: PER, EV/EBITDA, Price/Book, PEG
- **Rentabilidad**: Márgenes, ROE, ROA
- **Salud Financiera**: Deuda, Caja, Liquidez
- **Graham Number**: Cálculo automático de Fair Value

### Análisis Técnico
- RSI (7 y 14 días), SMA 50/200, Tendencia (Bullish/Bearish)
- **+130 Tooltips Educativos** en español

### Calendario Financiero
- Vista mensual con eventos de ganancias y dividendos
- EPS estimado y montos de dividendo
- Sincronización cada 6 horas

---

## 🛠️ Infraestructura

### Sistema de Backup
- Programador automático (diario/semanal/mensual)
- Envío por email con cifrado AES-256
- Gestión inteligente de tamaño (>25MB = aviso)

### Testing
- Test runner con salida ordenada (Verde/Rojo)
- Debug log persistente (`test_debug.log`)

### Correcciones Críticas
- Soporte GBX (Penique Británico) con normalización automática
- Estado de mercado sincronizado con Yahoo Finance V10
- Orden de noticias corregido (más recientes primero)
- Estrategia ISIN Fallback para símbolos internacionales

### Optimizaciones de Rendimiento (v2.3.0)
- **Cache de MarketStatus Server-Side**: Solo 1 llamada a Yahoo por minuto para los índices de cabecera, independientemente del número de navegadores conectados
- **Tabla `ticker_details_cache`**: Persistencia de datos profundos para modales de Discovery

### Experiencia de Usuario
- **Refresh de Portfolio**: Botón manual de actualización con cooldown de 60 segundos
- **Auto-Refresh**: Actualización automática de precios cada 5 minutos
- **Feedback Visual**: Contador de cooldown y estado de carga en tiempo real

---

## 🔮 Próximamente
- Análisis de Sentimiento con modelos locales
- Escáner de Dividendos Global
- Optimización del Harvester Global

---

**Versión**: 2.1.0  
**Última actualización**: Enero 2026
