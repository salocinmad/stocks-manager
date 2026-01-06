# 🚀 Stocks Manager v2.1.0 Release Notes
## "The Global Vigilante & AI Update"

Esta versión unifica la potencia del motor de **Alertas Globales** con la inteligencia autónoma de descubrimiento, estableciendo el estándar v2.1.0 como la versión estable actual.

---

## ✨ Principales Novedades

### 🖥️ Dashboard Rediseñado (Layout 2 Columnas)
- **Estructura Optimizada**: Nueva arquitectura de dos columnas (75% principal / 25% lateral).
- **Columna Principal**: Stats (Patrimonio, Variación, Ganancia), Top Movers, Gráfico PnL.
- **Columna Lateral**: Botón de Análisis IA y Gráfico de Distribución por Sector.
- **AI Insight Reposicionado**: El resultado del análisis IA aparece entre los stats y los movers.
- **Alturas Consistentes**: Todas las tarjetas de la primera fila tienen altura uniforme.

### 🌍 Alertas Globales de Portafolio
- **Monitorización Total**: Configura una única alerta que vigila el cambio porcentual diario de **cada activo** dentro de un portafolio.
- **Cooldown Inteligente por Activo**: Si un activo dispara la alerta (ej. AAPL +5%), entra en "snooze" individualmente, mientras los demás activos siguen siendo vigilados.
- **Configuración Simplificada**: Nueva pestaña "Global" en el creador de alertas.

### 🔔 Gestión de Alertas Avanzada
- **Boton de Restablecer**: Reactiva alertas disparadas directamente desde la interfaz con un solo clic.
- **Reset Global (Admin)**: Herramienta de emergencia en el panel de administración para restablecer TOAS las alertas del sistema.
- **Grid de Alta Densidad**: Nuevo diseño de 3 columnas para pantallas grandes (2xl).

### 🧠 Motor de IA Multi-Proveedor
- **Proveedores**: Gemini, OpenRouter (Claude, GPT-4), Groq, Ollama, LM Studio
- **Configuración Dinámica**: Añade/cambia proveedores desde Admin sin reiniciar

### 🦁 Discovery Engine (Crawler v2)
- **Arquitectura Split-World**: Pipelines separados USA (Finnhub) vs Global (Yahoo Trending)
- **Marcado de Fallidos**: Los tickers incompatibles con Yahoo se marcan para saltar en futuros ciclos

---

## 🛠️ Cambios Técnicos

### Backend Unificado
- **API `/api/alerts` Consolidada**: Fusiona la gestión de alertas de stock individuales y alertas de portafolio en un solo endpoint.
- **Auto-Migración**: Nueva columna `triggered_assets` (JSONB) para gestión de estado granular.

### Optimización
- **Cache de MarketStatus**: Solo 1 llamada a Yahoo por minuto para los índices.
- **Tabla `ticker_details_cache`**: Persistencia de datos profundos.

---

## 📜 Historial (Versiones Anteriores)

### v2.0.0 (Archivado)
- Panel de Análisis de Posición (5 Pestañas)
- Catálogo Maestro de Tickers (EODHD)
- Alertas Técnicas (RSI, SMA)

---

**Versión Actual**: 2.1.0  
**Última actualización**: Enero 2026
