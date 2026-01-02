# 🚀 Stocks Manager v2.1.0 Release Notes
## "The Autonomous Intelligence Update"

Esta versión marca un hito en la evolución de Stocks Manager, transformando la plataforma de un gestor pasivo a un **sistema inteligente de descubrimiento y análisis**.

---

### ✨ Nuevas Funcionalidades

#### 1. 🧠 Motor de Inteligencia Artificial Multi-Proveedor
Ahora eres libre de elegir quién analiza tu cartera. Hemos reescrito el núcleo de IA para ser agnóstico del proveedor.
- **Soporte Nativo**: Conecta con **Gemini** (Google), **OpenRouter** (Acceso a Claude, GPT-4), **Groq** (Inferencias ultra-rápidas), o modelos locales (**Ollama**, **LM Studio**) para máxima privacidad.
- **Configuración Dinámica**: Añade, edita y cambia proveedores desde el panel de administración sin reiniciar el servidor.
- **Prompts Contextuales**: La IA ahora recibe noticias reales, datos fundamentales y técnicos de tus posiciones para un análisis preciso.

#### 2. 🦁 Mejoras en Discovery Engine (Granular & Smart)
El motor de descubrimiento ha recibido una actualización significativa para ofrecer control total sin cambiar su versión base:
- **Control Granular**: Nuevos sliders en el panel Admin para configurar ciclos por hora (1-60) y volumen de escaneo individual para cada worker (V8 Técnico, Finnhub Noticias, V10 Fundamental).
- **Modos Predefinidos (Presets)**:
  - **🐢 Stealth**: Mínimo impacto, bajo tráfico.
  - **⚖️ Balanced**: Equilibrio recomendado.
  - **🐺 Wolf Mode**: Escaneo agresivo cada 5 minutos (hasta 2000 items/hora) para máxima cobertura.
- **Market Open Awareness**: El crawler detecta automáticamente si los mercados de EE.UU. o Europa están abiertos y prioriza la búsqueda de "Day Gainers" y "Most Actives" en tiempo real.
- **Arquitectura Híbrida**: Ejecución paralela optimizada de tres workers especializados.

#### 3. 📊 Datos Financieros Enriquecidos
Hemos profundizado en los datos que el sistema recolecta.
- **Análisis Fundamental Profundo**: Pestaña dedicada con métricas de Valoración (PER, EV/EBITDA), Rentabilidad (ROE, Márgenes), Salud Financiera (Deuda/Equity) y Dividendos completos.
- **Análisis Técnico**: RSI (Índice de Fuerza Relativa) y Medias Móviles (SMA50/200) calculados automáticamente.
- **Noticias en Tiempo Real**: Feed de noticias integrado y mejorado.

#### 4. 📅 Calendario Financiero Avanzado
- **Vista Mensual**: Visualiza eventos de ganancias y dividendos en un calendario interactivo.
- **Datos Detallados**: Consulta el **EPS Estimado** y el **Monto del Dividendo** directamente en la tarjeta del evento.
- **Filtros**: Alterna fácilmente entre eventos de **"Mis Acciones"** y eventos generales del **"Mercado"**.
- **Sincronización Inteligente**: El sistema actualiza automáticamente los eventos cada 6 horas, respetando los ciclos del crawler para no saturar la red.

#### 5. 📊 Panel de Análisis de Posición (NUEVO)
Análisis profundo de cada posición en tu cartera con un modal de 5 pestañas:
- **Posición**: Cantidad, precio medio, PnL (€/%), peso en cartera, fechas de operación.
- **Técnico**: RSI (14), SMA 50/200, tendencia (Golden/Death Cross), timestamp de último cálculo.
- **Riesgo**: Volatilidad anualizada, Sharpe Ratio, Sortino Ratio, Max Drawdown, Beta vs S&P500, VaR 95%, Score de Riesgo (1-10).
- **Analistas**: Consenso de recomendaciones (Comprar/Mantener/Vender), precio objetivo, desglose detallado, sentimiento de insiders.
- **Simulador What-If**: Simula el impacto de comprar más acciones, vender parte de la posición o cambios de precio.
- **Cálculos Automáticos**: Job programado cada 6 horas (00:00, 06:00, 12:00, 18:00) para precalcular métricas.

#### 6. 🔔 Alertas Avanzadas (NUEVO)
Sistema de alertas renovado con nuevos tipos:
- **Alertas Técnicas (RSI)**: Notificación cuando el RSI cruza umbrales de sobrecompra (>70) o sobreventa (<30).
- **Alertas de Cruce SMA**: Golden Cross (SMA50 cruza por encima de SMA200) y Death Cross (señal bajista).
- **Alertas de Portfolio**: Alertas a nivel de cartera completa:
  - PnL absoluto (€) por encima/debajo de umbral
  - PnL porcentual (%) objetivo
  - Valor total de cartera
  - Exposición sectorial máxima
- **Soporte Multi-idioma**: Preferencia de idioma para alertas de noticias (ES/EN).

#### 7. ⌨️ Atajos de Teclado (NUEVO)
Navegación rápida con hotkeys:
- `Ctrl+K`: Búsqueda global (Command Palette)
- `Ctrl+D`: Ir a Dashboard
- `Ctrl+P`: Ir a Cartera
- `Ctrl+A`: Ir a Alertas  
- `Ctrl+W`: Ir a Watchlist
- `Ctrl+N`: Nueva operación
- `?`: Mostrar ayuda de atajos
- `ESC`: Cerrar modal activo

#### 8. 🛠️ Mejoras Administrativas
- **Gestión de Backups Totalmente Renovada**:
  - **Programador Automático**: Configura backups diarios, semanales o mensuales.
  - **Envío por Email**: Recibe tus copias de seguridad directamente en tu bandeja de entrada.
  - **Seguridad**: Cifra tus backups con contraseña para enviarlos por email de forma segura.
  - **Gestión Inteligente**: Si el backup supera los 25MB, recibirás un aviso para descargarlo manualmente.
  - **Tecnología**: Migración a `archiver` y `unzipper` para mayor fiabilidad en la compresión y restauración.
- **Configuración SMTP**: Configura tu servidor de correo para alertas desde la interfaz web.
- **Logs Mejorados**: Sistema de registro con marcas de tiempo precisas para mejor depuración.

#### 9. 🧪 Suite de Tests Renovada
- **Test Runner Personalizado**: Nueva herramienta de ejecución que ordena los resultados (Verde/Rojo) para máxima legibilidad.
- **Salida Limpia**: La terminal solo muestra el resumen de ejecución, ocultando ruido innecesario.
- **Debug Log Persistente**: Generación automática de `server/tests/test_debug.log` con el stack trace completo de la última sesión para auditoría profunda.

---

### 🐛 Correcciones y Optimizaciones
- **Finnhub Discovery**: Solucionado el problema donde la API gratuita no devolvía tickers en noticias (implementado fallback a Yahoo Screener).
- **Rendimiento**: Optimización del cálculo de PnL y caché de mercado en base de datos.
- **UI**: Mejoras visuales en el Dashboard y corrección de colores en gráficos sectoriales.
- **Backend Crítico**: Reparación de `marketData.ts` (funciones `getQuote`, `getAssetProfile`) y optimización de llamadas a Yahoo Finance.
- **Estado de Mercado**: Solucionado error visual donde los mercados aparecían siempre "Cerrados". Ahora se usa directamente el estado de Yahoo Finance V10 (`REGULAR`, `PRE`, `POST`) para mantener la concordancia con el frontend.

#### 🆕 Datos Fundamentales (Update v2.1.0)
Se han añadido capacidades de análisis fundamental profundo:
- **Pestaña "Fundamental"**: Nueva sección en el Modal de Análisis con 4 categorías:
  - **Valoración**: Market Cap, EV, PER, PEG, Price/Book.
  - **Rentabilidad**: Márgenes (Operativo/Neto), ROE, ROA.
  - **Salud Financiera**: Deuda Total, Caja, Ratios de Liquidez.
  - **Dividendos**: Yield, Payout Ratio, Fechas Ex-Corte.
- **Tooltips Educativos**: Explicaciones detalladas al pasar el ratón sobre cualquier métrica (Técnico, Riesgo y Fundamental).
- **Backend Optimizado**: Caché inteligente de 14 días para datos fundamentales estables.

---

### 🔮 Próximamente
- Análisis de Sentimiento avanzado con Modelos Locales.
- Simulador de Escenarios de Cartera ("What If").
