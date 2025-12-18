# Stocks Manager

**Stocks Manager** es una plataforma integral para la gestión y seguimiento de carteras de inversión. Diseñada para inversores que buscan control total sobre sus activos, ofrece cálculos precisos de rentabilidad, seguimiento en tiempo real y herramientas avanzadas de análisis, todo bajo tu control (self-hosted).

## 🚀 Características Principales

### 📊 Gestión de Carteras
- **Seguimiento de Posiciones**: Vista detallada de tus activos con coste promedio, valor de mercado y rendimiento.
- **Soporte Multi-Divisa**: Gestión automática de tipos de cambio (EUR/USD, EUR/GBP, etc.) para unificar tu patrimonio en EUR.
- **Rentabilidad en Tiempo Real**: Cálculo de Ganancia/Pérdida (PnL) diario y total, incluyendo el impacto de las divisas.

### 📈 Análisis y Gráficos
- **Contribución por Empresa**: Visualiza el peso real de cada activo en tu cartera.
- **Evolución PnL**: Gráficos históricos de tus ganancias y pérdidas en los últimos 30 días.
- **Histórico de Operaciones**: Registro detallado de todas tus compras y ventas pasadas.

### ⚡ Datos de Mercado
- **Fuentes Híbridas**: Combina la robustez de **Yahoo Finance** con la precisión en tiempo real de **Finnhub** para el mercado americano.
- **Actualizaciones Automáticas**: Sistema de cron (scheduler) configurable para mantener los precios al día.
- **Cierre Diario**: Snapshots automáticos de tu cartera al cierre de mercado para análisis histórico.

### 🛡️ Seguridad y Control
- **Autenticación Robusta**: Sistema de usuarios con roles y contraseñas encriptadas.
- **Doble Factor (2FA)**: Capa extra de seguridad compatible con Google Authenticator/Authy.
- **Backups Integrales**: Sistema de copia de seguridad y restauración completa (JSON/SQL) desde el panel de administración.

---

## 🛠️ Stack Tecnológico

El proyecto está construido sobre una arquitectura moderna y robusta:

- **Frontend**: React + Vite (Rápido y ligero).
- **Gráficos**: Recharts.
- **Backend**: Node.js + Express.
- **Base de Datos**: MariaDB (con ORM Sequelize).
- **Contenerización**: Docker y Docker Compose para un despliegue sencillo.

---

## 📚 Documentación

Hemos preparado guías detalladas para que saques el máximo partido a la aplicación:

- **[Guía de Instalación](INSTALL.md)**: Paso a paso para desplegar tu propia instancia (Docker o Local).
- **[Manual de Usuario](USER_GUIDE.md)**: Aprende a gestionar tus operaciones, activar 2FA y usar las herramientas gráficas.
- **[Manual de Administración](ADMIN_GUIDE.md)**: Guía para el "propietario" del sistema: configuración, backups, gestión de usuarios y mantenimiento.
- **[Créditos](CREDITS.md)**: Reconocimiento a las bibliotecas y recursos utilizados.

---

## 🤝 Contribuir

Si eres desarrollador y quieres mejorar Stocks Manager, ¡toda ayuda es bienvenida! Revisa el código, abre *issues* o envía tus *pull requests*.

---

*Disfruta de la libertad de gestionar tu patrimonio con tus propias reglas.*
