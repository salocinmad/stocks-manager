# 📈 Stocks Manager

**Stocks Manager** es una plataforma integral para la gestión de carteras de inversión, diseñada para inversores particulares que buscan un control profesional de sus activos.

Permite realizar seguimiento de acciones, criptomonedas y fondos, analizar rendimiento (PnL), gestionar comisiones, y recibir asistencia financiera mediante Inteligencia Artificial.

![Dashboard Preview](https://via.placeholder.com/800x400?text=Stocks+Manager+Dashboard)

---

## ✨ Características Principales

- **📊 Gestión de Portfolios**: Múltiples carteras, soporte multidivisa y cálculo de PnL en tiempo real.
- **🖼️ Soporte Multimedia**: Subida de avatares de usuario y adjuntos en notas.
- **🤖 Motor IA Multi-Proveedor (V6)**:
  - **Agnóstico**: Usa Gemini, OpenRouter, Groq, Ollama o LM Studio.
  - **Contexto Financiero**: La IA conoce noticias, precios, fundamentales (PER, Beta) e indicadores técnicos (RSI).
  - **Personalizable**: Configura proveedores y prompts desde el panel de administración.
- **📱 Progressive Web App (PWA v2.1.1)**:
  - Instalable en Android desde Chrome.
  - Nuevo logo corporativo (escudo + barras + flecha).
  - Service Worker para cache de assets.
- **🚀 Motor de Descubrimiento (Discovery Engine v2.1.1)**:
  - **Arquitectura Split-World**: Escaneo diferenciado para USA (Finnhub) y Global (Yahoo Trending).
  - **Enriquecimiento Inteligente**: Autodetección y corrección de sectores desconocidos.
  - **Rescate por ISIN**: Fallback automático para mapear tickers fallidos entre mercados.
  - **Persistencia Acumulativa**: Los datos se fusionan (Append) para construir un catálogo histórico sin pérdidas.
- **🌎 Librería Global (Master Library)**:
  - Base de datos de más de 12.000 activos mundiales sincronizados vía EODHD.
  - Soporte universal de ISIN para identificación unívoca.
- **💰 Gestión de Comisiones**: Registro detallado de comisiones por operación y ajuste de bases de coste.
- **🔔 Alertas Inteligentes**: Notificaciones por precio, RSI (v2.1.1), cruces de medias y volumen.
- **📝 Notas Ricas**: Editor Markdown para anotar tesis de inversión en cada posición.
- **📅 Calendario Financiero**: Eventos macroeconómicos, dividendos y estimaciones de EPS (Yahoo Finance V10).
- **💾 Backup Automatizado**: Sistema programable (Diario/Semanal) con cifrado, envío por Email y soporte multimedia.
- **🔒 Seguridad**: Autenticación 2FA (TOTP), hash bcrypt y estructura Dockerizada.
- **📱 Diseño Responsive (v2.1.1)**:
  - Navegación móvil con bottom bar y drawer lateral.
  - ChatBot fullscreen en móvil.
  - Vistas adaptadas: Cards en cartera, tabs compactas en admin.
  - Gestos táctiles para interacción natural.

---

## 🚀 Instalación Rápida (Pre-built Image)

La forma recomendada de instalar Stocks Manager es utilizando la imagen oficial de Docker.

**Requisitos:** Docker y Docker Compose.

1. **Crear directorio y descargar configuración**:
   ```bash
   mkdir stocks-manager && cd stocks-manager
   
   # 1. Configuración de entorno
   wget https://raw.githubusercontent.com/salocinmad/stocks-manager/main/.env.example -O .env
   
   # 2. Archivo Docker Compose (Producción)
   wget https://raw.githubusercontent.com/salocinmad/stocks-manager/main/docker-compose.prod.yml -O docker-compose.yml
   ```
   *(También puedes usar `curl -o` si no tienes wget)*

2. **Editar configuración**:
   ```bash
   nano .env
   # IMPORTANTE: Configura DB_USER, DB_PASSWORD y sobre todo JWT_SECRET
   ```

3. **Arrancar**:
   ```bash
   docker compose up -d
   ```
   El sistema descargará automáticamente la última imagen y creará la base de datos.

### Opción Desarrolladores (Build from Source)

Si quieres modificar el código:
```bash
git clone https://github.com/salocinmad/stocks-manager.git
cd stocks-manager
cp .env.example .env
docker compose up -d --build
```

---

## 📚 Documentación

Para guías detalladas, consulta:

- **[📖 Manual de Usuario](MANUAL_USUARIO.md)**: Guía completa de todas las funcionalidades.
- **[🛠️ Guía de Administrador](GUIA_ADMINISTRADOR.md)**: Configuración del servidor, IA, backups y usuarios.
- **[🙏 Créditos](CREDITOS.md)**: Tecnologías y librerías utilizadas.

---

## 🛠️ Stack Tecnológico

- **Frontend**: React 19, TailwindCSS, Recharts.
- **Backend**: Bun, ElysiaJS, PostgreSQL.
- **IA**: Google Generative AI SDK, OpenAI-Compatible REST logic.
- **Infraestructura**: Docker, Docker Compose.

---

## 📄 Licencia

Distribuido bajo la licencia MIT. Ver `LICENSE` para más información.
