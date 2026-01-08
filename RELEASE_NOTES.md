# 🚀 Stocks Manager v2.1.0
## "The Global Vigilante & AI Update"

Esta versión unifica la potencia del motor de **Alertas Globales** con la inteligencia autónoma de descubrimiento y el nuevo **Catálogo Maestro Configurable**.

---

## ✨ Novedades Principales

### 🌍 Catálogo Maestro Configurable
Nueva funcionalidad para administradores que permite configurar qué bolsas mundiales alimentan el sistema:

- **Ubicación**: Admin → Mercado → Catálogo Maestro
- **77+ Bolsas**: Lista completa incluyendo NYSE, NASDAQ, AMEX + bolsas globales
- **Bolsas de US**: Ahora disponibles NYSE, NASDAQ y AMEX como bolsas individuales
- **Cosecha Mundial**: Botón para sincronizar tickers de las bolsas seleccionadas
- **Búsqueda**: Filtrado por país, código o nombre
- **Toggle "Solo Seleccionadas"**: Ver rápidamente qué bolsas están activas
- **Limpieza Profunda**: Al desmarcar una bolsa se eliminan sus datos automáticamente

### 🖥️ Dashboard Rediseñado
Nueva arquitectura de **dos columnas** optimizada:

| Columna Principal (75%) | Columna Lateral (25%) |
|-------------------------|----------------------|
| Stats: Patrimonio, Variación, Ganancia | Botón Análisis IA |
| AI Insight (resultado del análisis) | Distribución por Sector |
| Top Movers del Día | |
| Gráfico PnL Histórico | |

---

### 🔔 Sistema de Alertas Mejorado

#### Alertas Globales de Portafolio
Una única alerta que vigila el cambio porcentual diario de **todos los activos**:
- **Cooldown por Activo**: Snooze individual al disparar
- **Configuración rápida**: Nueva pestaña "Global" en el creador

#### Tipos de Alertas
- Precio (arriba/abajo)
- Cambio porcentual
- RSI (sobrecompra/sobreventa)
- Cruce de SMA (50/200)
- Volumen anómalo

---

### 🕸️ Discovery Engine (Crawler v2)
Motor de descubrimiento con arquitectura **Split-World**:

- **Pipeline USA**: Finnhub para trending americano
- **Pipeline Global**: Yahoo Trending para EU/ASIA
- **Regiones Dinámicas**: Lee `GLOBAL_TICKER_EXCHANGES` de configuración
- **Marcado Inteligente**: Tickers fallidos se omiten automáticamente
- **Enriquecimiento V10**: Fair Value (Graham Number), fundamentales

---

### 📊 Análisis de Posición (6 Pestañas)
Modal de análisis completo para cada posición:

1. **Posición**: Datos de cartera, peso, PnL, coste base
2. **Técnico**: RSI, SMA50, SMA200, tendencia
3. **Riesgo**: Volatilidad, Sharpe, Sortino, MaxDrawdown, VaR95, Beta
4. **Fundamental**: PER, EPS, dividendos, Fair Value (Graham)
5. **Analistas**: Consenso, precio objetivo, insider sentiment
6. **What-If**: Simulador de escenarios (compra/venta/precio)

---

## 🛠️ Mejoras Técnicas

| Área | Mejora |
|------|--------|
| **Catálogo Maestro** | Bolsas NYSE/NASDAQ/AMEX añadidas |
| **Mapeo EODHD→Yahoo** | 50+ bolsas mapeadas (`exchangeMapping.ts`) |
| **Caché EODHD** | Lista de bolsas cacheada 30 días |
| **Limpieza Profunda** | Eliminación automática de datos al desmarcar |
| **IA Multi-Provider** | Factory Pattern para Gemini/OpenRouter/Ollama |
| **Frontend** | Lazy Loading, Code Splitting |
| **Backup** | Stream-to-Disk, compresión AES-256 |
| **Soporte GBX** | Conversión automática peniques → libras |

---

## 📂 Archivos Clave

| Archivo | Descripción |
|---------|-------------|
| `server/services/eodhdService.ts` | Cliente EODHD con bolsas US |
| `server/utils/exchangeMapping.ts` | Mapeo EODHD → Yahoo |
| `src/components/admin/MasterCatalogConfig.tsx` | UI catálogo maestro |
| `server/services/positionAnalysisService.ts` | Análisis 6 pestañas |

---

## 📜 Historial de Correcciones

### Hotfix 8 Enero 2026
- **Bolsas US**: Añadidas NYSE, NASDAQ, AMEX al catálogo maestro
- **Cosecha Mundial**: Botón disponible en Catálogo Maestro (antes solo en Sincronización)

### Hotfix 7 Enero 2026
- **Precisión Decimal**: Solucionado separadores (puntos vs comas)
- **Tipos de Cambio**: Corregido bug en ventas (SELL)
- **Comisiones**: Alineación `commission` ↔ `fees`
- **Ordenación Dashboard**: Invertido orden en "Peores del Día"

---

## 📜 Versiones Anteriores

### v2.0.0
- Panel de Análisis de Posición (5 Pestañas)
- Catálogo Maestro de Tickers (EODHD)
- Alertas Técnicas (RSI, SMA)

---

**Versión**: 2.1.0
**Fecha de Publicación**: 8 Enero 2026
