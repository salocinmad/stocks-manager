# 🚀 Stocks Manager v2.1.0
## "The Global Vigilante & AI Update"

Esta versión unifica la potencia del motor de **Alertas Globales** con la inteligencia autónoma de descubrimiento y el nuevo **Catálogo Maestro Configurable**.

---

## ✨ Novedades Principales

### 🌍 Catálogo Maestro Configurable [NUEVO]
Nueva funcionalidad para administradores que permite configurar qué bolsas mundiales alimentan el sistema:

- **Ubicación**: Admin → Mercado → Catálogo Maestro
- **74+ Bolsas**: Lista completa de bolsas desde EODHD API (US, Europa, Asia, Américas)
- **Búsqueda**: Filtrado por país, código o nombre
- **Toggle "Solo Seleccionadas"**: Ver rápidamente qué bolsas están activas
- **Detección de Códigos Huérfanos**: Warning cuando hay códigos guardados que ya no existen
- **Limpieza Profunda Automática**: Al desmarcar una bolsa se eliminan:
  - Registros de `global_tickers`
  - Datos de `ticker_details_cache`
  - Entradas de `market_discovery_cache`

### 🖥️ Dashboard Rediseñado
Nueva arquitectura de **dos columnas** optimizada para mejor experiencia visual:

| Columna Principal (75%) | Columna Lateral (25%) |
|-------------------------|----------------------|
| Stats: Patrimonio, Variación, Ganancia | Botón Análisis IA |
| AI Insight (resultado del análisis) | Distribución por Sector |
| Top Movers del Día | |
| Gráfico PnL Histórico | |

---

### 🔔 Sistema de Alertas Mejorado

#### Alertas Globales de Portafolio
Una única alerta que vigila el cambio porcentual diario de **todos los activos** de un portafolio:
- **Cooldown por Activo**: Si AAPL dispara (+5%), entra en snooze individualmente
- **Configuración rápida**: Nueva pestaña "Global" en el creador de alertas

#### Gestión Avanzada
- **Botón Restablecer**: Reactiva alertas disparadas con un clic
- **Reset Global (Admin)**: Herramienta de emergencia
- **Grid de Alta Densidad**: Diseño de 3 columnas para pantallas 2xl

---

### 🦁 Discovery Engine (Crawler v2)
Motor de descubrimiento con arquitectura **Split-World** y **regiones dinámicas**:

- **Pipeline USA**: Finnhub para noticias y trending americano
- **Pipeline Global**: Yahoo Trending para EU/ASIA
- **Regiones Dinámicas**: Lee `GLOBAL_TICKER_EXCHANGES` de configuración (no hardcodeado)
- **Marcado Inteligente**: Tickers incompatibles se marcan para omitir
- **Gráfico de Velas**: Visualización OHLC con rangos de 30D, 60D y 6M

---

## 🛠️ Mejoras Técnicas

| Área | Mejora |
|------|--------|
| **Catálogo Maestro** | UI configurable para bolsas mundiales |
| **Mapeo EODHD→Yahoo** | 50+ bolsas mapeadas en `exchangeMapping.ts` |
| **Caché EODHD** | Lista de bolsas cacheada 30 días en `market_cache` |
| **Limpieza Profunda** | Eliminación automática de datos al desmarcar bolsas |
| **Regiones Dinámicas** | Discovery Job lee config de `system_settings` |
| **Base de Datos** | Consistencia en tablas `global_tickers`, `ticker_details_cache` |
| **Frontend** | Lazy Loading (Code Splitting) |
| **Seguridad** | Transacciones Atómicas (SQL Transaction) |
| **Crawler** | Ingestión por Lotes (Batch) y Paralelismo |
| **Backup** | Stream-to-Disk + Compresión Rápida |

---

## 📂 Archivos Nuevos (v2.1.0)

| Archivo | Descripción |
|---------|-------------|
| `server/utils/exchangeMapping.ts` | Mapeo EODHD Code → Yahoo Suffix |
| `src/components/admin/MasterCatalogConfig.tsx` | Componente UI catálogo maestro |
| Endpoints: `GET/POST /admin/market/exchanges` | API de configuración de bolsas |

---

## 📜 Historial

### v2.0.0
- Panel de Análisis de Posición (5 Pestañas)
- Catálogo Maestro de Tickers (EODHD)
- Alertas Técnicas (RSI, SMA)

---

**Versión**: 2.1.0  
**Fecha de Publicación**: 7 Enero 2026
