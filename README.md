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
- **🚀 Motor de Descubrimiento (Stocks Crawler)**:
  - Escaneo automático (cada 10m) de oportunidades de mercado.
  - Arquitectura Híbrida Inteligente: Yahoo (Screening) + Finnhub (Precios).
  - Detección de tendencias en Tecnología, Salud, Finanzas y Noticias Virales.
- **💰 Gestión de Comisiones**: Registro detallado de comisiones por operación y ajuste de bases de coste.
- **🔔 Alertas Inteligentes**: Notificaciones por precio, variación porcentual y volumen (Email, Telegram).
- **📝 Notas Ricas**: Editor Markdown para anotar tesis de inversión en cada posición.
- **📅 Calendario Financiero**: Eventos macroeconómicos, fechas de dividendos, y estimaciones de EPS (Yahoo Finance V3).
- **💾 Backup Automatizado**: Sistema de copia de seguridad programable (Diario/Semanal) con envío por Email y protección por contraseña. Soporta ZIP (Datos + Imágenes) y SQL.
- **🔒 Seguridad**: Autenticación 2FA (TOTP), hash bcrypt y estructura Dockerizada.

---

## 🚀 Instalación Rápida (Docker)

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/salocinmad/stocks-manager.git
   cd stocks-manager
   ```

2. **Configurar entorno**:
   ```bash
   cp server/env.example .env
   # Edita .env con tus claves (DB, JWT, APIs)
   ```

3. **Arrancar**:
   ```bash
   docker compose up -d --build
   ```

4. **Acceder**:
   - Web: `http://localhost:3000`
   - API: `http://localhost:3000/api`

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
