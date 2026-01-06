# Arquitectura de Descubrimiento y Enriquecimiento (v2.1.0)

Este documento describe el motor de inteligencia de mercado de Stocks Manager, basado en una arquitectura de tres capas diseñada para la cobertura global y la eficiencia de API.

---

## 🏗️ 1. Arquitectura de Tres Capas (The Three-Layer Model)

### Capa 0: Infraestructura Global (Master Library)
**Motor:** `globalTickerJob.ts` | **Fuente:** EODHD
- **Propósito**: Actúa como la "guía telefónica" universal del sistema. 
- **Funcionamiento**: Descarga periódicamente (mensual) la lista completa de tickers de las 20 bolsas principales del mundo.
- **Dato Crítico**: Almacena el **ISIN** de cada activo. El ISIN es el identificador único que nos permite "rescatar" empresas cuando Yahoo Finance usa un símbolo no estándar.
- **Filtro**: Solo acciones comunes (`Common Stock`).

### Capa 1: El Radar (Discovery Job)
**Motor:** `discoveryJob.ts` | **Fuente:** Finnhub + Yahoo Trending
- **Propósito**: Detectar oportunidades de inversión en tiempo real basándose en momentum y popularidad.
- **Estrategia Split-World**:
    - **Pipeline USA (Finnhub)**: Escanea noticias y busca tickers que aparecen en titulares de tecnología y negocios.
    - **Pipeline Global (Yahoo Trending)**: Detecta activos con volumen inusual o tendencias de búsqueda en regiones específicas (ES, DE, FR, GB, HK).
- **Control de Freshness**: Solo envía a enriquecer si el activo es nuevo o sus datos tienen más de 7 días.

### Capa 2: El Analista (Catalog Enrichment Job)
**Motor:** `catalogEnrichmentJob.ts` | **Fuente:** Yahoo Finance V10 (Enhanced)
- **Propósito**: Realizar un escaneo sistemático y profundo de todo el Catálogo Maestro generado en la Capa 0.
- **Funcionamiento**:
    - Selecciona lotes de empresas de la `Master Library` que aún no han sido analizadas.
    - **Estrategia de Rescate (ISIN Fallback)**: Si el ticker oficial falla, utiliza el ISIN de la Capa 0 para buscar el símbolo correcto en Yahoo.
    - **Persistencia Incremental**: Utiliza lógica `Append` para ir sumando empresas al catálogo `catalog_global` sin borrar las anteriores.
- **Resultados**: Calcula métricas complejas como Altman Z-Score, RSI, RSI7, SMA50/200, Sharpe Ratio y Voltadilidad.

---

## 📊 2. Flujo de Datos y Persistencia

El sistema utiliza la tabla `market_discovery_cache` para almacenar el resultado de este proceso.
- **Caché Inteligente**: Se reutilizan datos históricos de la base de datos si tienen menos de 2 días de antigüedad para ahorrar cuota de API (Econostat).
- **Categorías**:
    - `catalog_global`: Acumula el análisis profundo de la Capa 2.
    - `trending_global` / `trending_usa`: Almacena el momentum temporal de la Capa 1.

---

## 🛠️ 3. Configuración y Control

Todo el motor se gestiona desde **Admin → General**:
- **Control Maestro**: Apagado total del sistema (Kill Switch).
- **Ajuste Fino**: Configuración de llamadas por ciclo y frecuencia de ejecución para evitar bloqueos por parte de los proveedores.

---
*Este documento es la referencia técnica para el mantenimiento del sistema de crawling.*
