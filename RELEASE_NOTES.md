# 🚀 Stocks Manager v2.1.0
## "The Global Vigilante & AI Update"

Esta versión unifica la potencia del motor de **Alertas Globales** con la inteligencia autónoma de descubrimiento, estableciendo v2.1.0 como la versión estable actual.

---

## ✨ Novedades Principales

### 🖥️ Dashboard Rediseñado
Nueva arquitectura de **dos columnas** optimizada para una mejor experiencia visual:

| Columna Principal (75%) | Columna Lateral (25%) |
|-------------------------|----------------------|
| Stats: Patrimonio, Variación, Ganancia | Botón Análisis IA |
| AI Insight (resultado del análisis) | Distribución por Sector |
| Top Movers del Día | |
| Gráfico PnL Histórico | |

- Alturas consistentes en todas las tarjetas
- Layout responsive adaptado a pantallas grandes

---

### 🔔 Sistema de Alertas Mejorado

#### Alertas Globales de Portafolio
Una única alerta que vigila el cambio porcentual diario de **todos los activos** de un portafolio:
- **Cooldown por Activo**: Si AAPL dispara (+5%), entra en snooze individualmente mientras los demás siguen vigilados
- **Configuración rápida**: Nueva pestaña "Global" en el creador de alertas

#### Gestión Avanzada
- **Botón Restablecer**: Reactiva alertas disparadas con un clic
- **Reset Global (Admin)**: Herramienta de emergencia para restablecer todas las alertas del sistema
- **Grid de Alta Densidad**: Diseño de 3 columnas para pantallas 2xl
- **API Consolidada**: Endpoint único `/api/alerts` para alertas individuales y de portafolio

---

### 🧠 Motor de IA Multi-Proveedor
Soporte completo para múltiples proveedores de IA con configuración dinámica desde el panel de administración:

| Proveedor | Tipo |
|-----------|------|
| Google Gemini | Cloud |
| OpenRouter (Claude, GPT-4) | Cloud |
| Groq | Cloud |
| Ollama | Local |
| LM Studio | Local |

---

### 🦁 Discovery Engine (Crawler v2)
Motor de descubrimiento con arquitectura **Split-World**:

- **Pipeline USA**: Finnhub para noticias y trending americano
- **Pipeline Global**: Yahoo Trending para EU/ASIA
- **Marcado Inteligente**: Tickers incompatibles se marcan automáticamente para omitir en futuros ciclos
- **Gráfico de Velas**: Visualización OHLC con rangos de 30D, 60D y 6M

---

## 🛠️ Mejoras Técnicas

| Área | Mejora |
|------|--------|
| **Caché** | MarketStatus con 1 llamada/minuto por índice |
| **Base de Datos** | Nueva tabla `ticker_details_cache` para datos profundos |
| **Migraciones** | Columna `triggered_assets` (JSONB) auto-aplicada |
| **Serialización** | Fix de JSON para datos PostgreSQL en endpoints API |

---

## 📜 Historial

### v2.0.0
- Panel de Análisis de Posición (5 Pestañas)
- Catálogo Maestro de Tickers (EODHD)
- Alertas Técnicas (RSI, SMA)

---

**Versión**: 2.1.0  
**Fecha de Publicación**: 6 Enero 2026
