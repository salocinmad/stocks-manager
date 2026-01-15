# 🚀 Stocks Manager v2.1.2
## "PnL Accuracy & Currency Consistency Update"

Esta versión corrige los cálculos de PnL y las conversiones de divisa para garantizar consistencia total entre Dashboard, Portfolio y el gráfico histórico.

---

## ✨ Novedades v2.1.2

### 💰 Nueva Tabla `pnl_history_detail`
Almacenamiento detallado del PnL por posición para auditoría completa:
- **Campos**: ticker, quantity, avg_price, market_price, position_currency, price_currency, position_rate_eur, price_rate_eur, cost_eur, value_eur, pnl_eur
- **Uso**: Permite reconstruir exactamente cómo se calculó el PnL de cualquier día

### 🔄 Corrección de Conversión GBX→EUR
- **Problema resuelto**: Los activos de LSE cotizados en peniques (GBX) ahora se convierten correctamente usando el multiplicador 0.01 + tasa GBP/EUR
- **Archivos modificados**: `pnlJob.ts`, `pnlService.ts`, `portfolios.ts`

### 💳 Comisiones desde Transacciones
- **Problema resuelto**: El campo `positions.commission` podía estar desactualizado
- **Solución**: El Dashboard ahora calcula comisiones como `SUM(transactions.fees WHERE type='BUY')`
- **Beneficio**: Consistencia total entre Dashboard y PnL histórico

### 📊 Variación Diaria Consistente
- **Antes**: Usaba `quote.pc` (previous close de Yahoo en tiempo real)
- **Ahora**: Calcula `PnL de hoy - PnL de ayer` usando `pnl_history_cache`
- **Beneficio**: La Variación Diaria coincide exactamente con la diferencia entre puntos consecutivos del gráfico PnL

### 🔧 Cambios Técnicos
- `pnlService.calculateDailyUnrealizedPnL()`: Acepta diccionarios separados para tasas de posición y tasas de precio
- `pnlJob.ts`: Almacena detalles en `pnl_history_detail` para cada posición/día
- `portfolios.ts`: Summary y pnl-history usan `tx_fees_sum` y variación diaria basada en caché

---

# 📱 Stocks Manager v2.1.1
## "PWA & Mobile Experience Update"

Esta versión convierte Stocks Manager en una **Progressive Web App (PWA)** instalable en Android y mejora la experiencia móvil del ChatBot.

---

## ✨ Novedades v2.1.1

### 📱 Progressive Web App (PWA)
Stocks Manager ahora es instalable directamente desde el navegador:

- **Instalación Android**: Chrome → Menú ⋮ → "Añadir a pantalla de inicio"
- **Nuevo Logo**: Escudo amarillo con barras + flecha de tendencia
- **Manifest.json**: Configuración completa de nombre, colores, iconos
- **Service Worker**: Cache inteligente de assets estáticos
- **Favicon actualizado**: Nuevo icono en pestañas del navegador
- **Iconos en UI**: Sidebar, Login, MobileNavigation con branding unificado

### 💬 ChatBot Responsive
El ChatBot ahora se adapta correctamente a dispositivos móviles:

| Aspecto | Móvil (< 768px) | Desktop (>= 768px) |
|---------|-----------------|-------------------|
| **Tamaño** | Fullscreen 100% | Flotante (md/lg/xl) |
| **Botón cerrar** | Grande (40px) visible | Pequeño (32px) |
| **Resize/PopOut** | Ocultos | Visibles |
| **Bordes** | Sin bordes | Redondeados con sombra |

- **Safe area**: Respeta notch en dispositivos iOS/Android
- **Botones de acción**: Tamaño aumentado para mejor touch target
- **Header compacto**: Optimizado para pantallas pequeñas

### 🔐 Auth Screens Responsive
Las pantallas de autenticación ahora se adaptan correctamente a móviles:

| Aspecto | Móvil (< 768px) | Desktop (>= 768px) |
|---------|-----------------|-------------------|
| **Layout** | Scroll vertical, desde arriba | Centrado vertical |
| **Padding** | `p-5` compacto | `p-14` amplio |
| **Título** | `text-xl` | `text-4xl` |
| **Logo** | `size-8` (32px) | `size-12` (48px) |
| **Bordes** | `rounded-2xl` | `rounded-[3rem]` |

- **Pantallas afectadas**: Login, 2FA, Forgot Password, Reset Password
- **Overflow**: `min-h-screen` + `overflow-y-auto` para scroll si es necesario

### 🔄 Dashboard Auto-Refresh
El Dashboard ahora mantiene la información fresca sin necesidad de recargar:

- **Intervalo**: Actualización automática cada **5 minutos**.
- **Datos sincronizados**: Mejores/Peores del día, Valor total, Ganancias/Pérdidas y Distribución sectorial.
- **Background update**: El refresco es silencioso, permitiendo seguir operando sin interrupciones ni pantallas de carga.

### 🛠️ Panel de Administración Responsive
Se ha completado la adaptación móvil de todos los componentes de administración externos:
- **AIGeneral**: Grids de configuraciones y editores de prompts adaptados.
- **AIProviders**: Gestión de proveedores mediante cards apilables.
- **AdminSMTP**: Formulario de configuración y test de email responsive.
- **LogsManager**: Selector de niveles y filtros de fecha optimizados para touch.
- **MasterCatalogConfig**: Búsqueda global y selector de bolsas mundial.
- **MarketIndicesSelector**: Selección de índices de cabecera en cuadrícula flexible.
- **DataExplorerTable**: Tabla de auditoría con controles compactos y scroll lateral.
- **Vistas**: Todos los contenedores usan `p-4` en móvil y `rounded-xl`, optimizando el espacio.

---

## 📁 Archivos PWA

| Archivo | Descripción |
|---------|-------------|
| `public/manifest.json` | Configuración PWA |
| `public/sw.js` | Service Worker con cache |
| `public/pwa-192x192.png` | Icono Android estándar |
| `public/pwa-512x512.png` | Icono splash screen |
| `public/logo-1024.png` | Icono alta resolución |
| `public/favicon.png` | Favicon del navegador |

---

## 🛠️ Cambios Técnicos

| Área | Cambio |
|------|--------|
| `index.html` | Links a manifest, favicon, SW registration |
| `Dockerfile` | Copia de assets PWA a dist/ |
| `Sidebar.tsx` | Nuevo logo imagen en lugar de icon |
| `MobileNavigation.tsx` | Logo en drawer header |
| `LoginScreen.tsx` | Logo en cabecera |
| `ResetPasswordScreen.tsx` | Logo en cabecera |
| `ChatBot.tsx` | Clases responsive para fullscreen móvil |
| `init_db.ts` | Migración APP_VERSION a V2.1.1 |

---

## 📜 Requisitos PWA

> ⚠️ **IMPORTANTE**: Las PWA requieren HTTPS en producción.
> En localhost funciona sin certificado.

Para verificar la instalación:
1. Abrir DevTools (F12) → Application → Manifest
2. Debe mostrar "Installable" ✓

---

## 📜 Historial v2.1.x

### v2.1.1 (9 Enero 2026)
- PWA instalable con nuevo logo
- ChatBot fullscreen en móvil
- Favicon y branding unificado

### v2.1.0 (8 Enero 2026)
- Catálogo Maestro Configurable (77+ bolsas)
- Dashboard 2 columnas
- Alertas Globales de Portafolio
- Discovery Engine Split-World
- Position Analysis Modal (6 tabs)
- Session Management mejorado
- Mobile Navigation (Drawer + Bottom Nav)

---

## 📜 Versiones Anteriores

### v2.0.0
- Panel de Análisis de Posición (5 Pestañas)
- Catálogo Maestro de Tickers (EODHD)
- Alertas Técnicas (RSI, SMA)
- Sistema Multi-AI

---

**Versión**: 2.1.1
**Fecha de Publicación**: 9 Enero 2026
