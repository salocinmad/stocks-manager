# 📊 Stocks Manager

**Sistema Profesional de Gestión de Carteras con Análisis Financiero Avanzado**

![Version](https://img.shields.io/badge/version-0.9.0-blue.svg)
![License](https://img.shields.io/badge/license-Custom-green.svg)
![Docker](https://img.shields.io/badge/docker-✓-brightgreen.svg)
![React](https://img.shields.io/badge/react-18.2.0-61DAFB.svg)
![Node](https://img.shields.io/badge/node-22-339933.svg)

---

## 🎯 ¿Qué es Stocks Manager?

**Stocks Manager** es una aplicación completa y auto-hospedada de gestión de carteras diseñada para inversores individuales que desean control total sobre el seguimiento y análisis de sus inversiones. Construida con tecnologías modernas y ejecutándose completamente en Docker, proporciona características de nivel profesional sin depender de servicios de terceros para tus datos financieros sensibles.

### Características Principales

- 📈 **Sistema Multi-Cartera** - Gestiona múltiples carteras de inversión de forma independiente
- 🔒 **Auto-hospedado y Privado** - Tus datos permanecen en tu infraestructura
- 📊 **Análisis Avanzado** - Análisis de drawdown, asignación por sector, métricas de riesgo, calendarios de calor
- 💰 **Precios en Tiempo Real** - Actualizaciones automáticas desde Yahoo Finance y Finnhub
- 🎨 **Interfaz Moderna** - Diseño limpio y responsivo con temas oscuro/claro
- 🐳 **Listo para Docker** - Despliegue con un solo comando y generación automática de credenciales
- 🌍 **Multi-Divisa** - Soporte para EUR, USD y tasas de cambio automáticas

---

## 🚀 Inicio Rápido

```bash
# 1. Clonar el repositorio
git clone https://github.com/yourusername/stocks-manager.git
cd stocks-manager

# 2. Iniciar con Docker Compose
docker compose up -d

# 3. Acceder a la aplicación
# Frontend: http://localhost:3000
# API Backend: http://localhost:5000

# 4. Iniciar sesión con las credenciales por defecto
# Usuario: admin
# Contraseña: admin123
```

**¡La configuración inicial es completamente automática!** La aplicación:
- Genera credenciales seguras de base de datos
- Crea el esquema de base de datos
- Inicializa un usuario administrador
- Inicia todos los servicios

📚 **Para instrucciones detalladas de instalación, ver [INSTALACION.md](INSTALACION.md)**

---

## 📖 Documentación

| Documento | Descripción |
|----------|-------------|
| **[INSTALACION.md](INSTALACION.md)** | Guía completa de configuración, requisitos y despliegue |
| **[GUIA_USUARIO.md](GUIA_USUARIO.md)** | Cómo usar las características de la aplicación |
| **[DOCUMENTACION_TECNICA.md](DOCUMENTACION_TECNICA.md)** | Arquitectura, referencia API, esquema de base de datos |
| **[SOLUCION_PROBLEMAS.md](SOLUCION_PROBLEMAS.md)** | Reseteo de contraseña admin, problemas comunes, soluciones |

---

## ✨ Características Principales

### Gestión de Carteras
- Crear y gestionar múltiples carteras independientes
- Seguimiento de operaciones de compra/venta con historial detallado
- Cálculo automático de coste base (FIFO)
- Soporte para PnL realizado y no realizado

### Análisis Financiero
- **Seguimiento de Rendimiento**
  - Cálculos diarios de PnL con datos históricos
  - Análisis de drawdown (pérdida máxima desde el pico)
  - Visualización de calendario de calor de rentabilidades diarias
  - Métricas de rendimiento mensual/anual

- **Análisis de Activos**
  - Gráficos de asignación por sector e industria
  - Datos de perfil de activos (beta, rendimiento de dividendos, capitalización de mercado)
  - Gráficos de precios históricos con velas OHLC
  - Seguimiento de rendimiento de acciones individuales

- **Métricas de Riesgo**
  - Cálculo de beta del portafolio
  - Análisis de concentración por sector
  - Seguimiento de volatilidad
  - Ratio de Sharpe y rentabilidades ajustadas por riesgo

### Datos y Automatización
- **Actualización de Precios**
  - Actualizaciones programadas automáticas cada 15 minutos
  - Integración con Yahoo Finance
  - Soporte para API de Finnhub
  - Mecanismos de respaldo para fiabilidad

- **Informes y Exportación**
  - Generar informes PDF completos
  - Exportar instantáneas de cartera
  - Archivo de estadísticas diarias de cartera
  - Seguimiento de datos históricos

### Experiencia de Usuario
- **Soporte Multi-Usuario**
  - Autenticación de usuario con JWT
  - Acceso basado en roles (admin/usuario)
  - Fotos de perfil
  - Carteras personales por usuario

- **Personalización**
  - Toggle de tema Oscuro/Claro
  - Enlaces externos personalizables (TradingView, Yahoo Finance, etc.)
  - Ordenamiento de posiciones (arrastrar y soltar)
  - Notas personales por posición

- **Alertas y Notificaciones**
  - Alertas de precio objetivo
  - Notificaciones por correo (configuración SMTP)
  - Seguimiento de cambios de precio en tiempo real

---

## 🏗️ Stack Tecnológico

### Frontend
- **React 18.2** - Biblioteca de UI moderna
- **Vite 5.2** - Herramienta de construcción ultra-rápida
- **Recharts** - Gráficos responsivos y hermosos
- **Lightweight Charts** - Gráficos de velas profesionales
- **React Router** - Enrutamiento del lado del cliente

### Backend
- **Node.js 22** - Runtime de JavaScript
- **Express 4.18** - Framework web
- **Sequelize 6.35** - ORM para MariaDB
- **JWT** - Autenticación
- **Yahoo Finance 2** - Datos de mercado
- **Nodemailer** - Notificaciones por correo

### Base de Datos e Infraestructura
- **MariaDB 11.4** - Base de datos relacional
- **Docker & Docker Compose** - Containerización
- **Nginx** - Servidor web frontend
- **Volúmenes Nombrados** - Persistencia de datos

---

## 🔐 Características de Seguridad

- **Generación Automática de Credenciales** - Contraseñas seguras creadas en la primera ejecución
- **Autenticación JWT** - Sesiones basadas en tokens
- **Hash de Contraseñas** - bcrypt con salt rounds
- **Protección contra Inyección SQL** - Vinculación de parámetros con Sequelize ORM
- **Configuración CORS** - Acceso controlado a la API
- **Docker Secrets** - Aislamiento de datos sensibles
- **Contraseña Maestra** - Recuperación de acceso admin de emergencia

---

## 🌍 Mercados Soportados

- **Acciones de EE.UU.** - NYSE, NASDAQ
- **Acciones Europeas** - Madrid (MC), Frankfurt, París, etc.
- **Divisas** - EUR, USD (conversión automática)
- **Internacional** - Cualquier acción soportada por Yahoo Finance

Ejemplos de formato de símbolos:
- `AAPL` (Apple en NASDAQ)
- `MSFT` (Microsoft en NASDAQ)
- `SAN.MC` (Santander en Bolsa de Madrid)
- `BMW.DE` (BMW en Bolsa de Frankfurt)

---

## 📝 Licencia

Este proyecto está licenciado bajo MIT. Ver [LICENSE](LICENSE) para detalles.

---

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Por favor, no dudes en enviar issues y pull requests.

### Configuración de Desarrollo

```bash
# Clonar el repositorio
git clone https://github.com/yourusername/stocks-manager.git

# Iniciar entorno de desarrollo
npm run dev:all  # Inicia frontend y backend en modo watch
```

Ver [DOCUMENTACION_TECNICA.md](DOCUMENTACION_TECNICA.md) para información detallada sobre arquitectura.

---

## 💬 Soporte

- **Issues**: [GitHub Issues](https://github.com/yourusername/stocks-manager/issues)
- **Documentación**: Ver docs en este repositorio
- **Solución de Problemas**: Revisar [SOLUCION_PROBLEMAS.md](SOLUCION_PROBLEMAS.md)

---

## 🙏 Agradecimientos

- **Yahoo Finance** - Proveedor de datos de mercado
- **Finnhub** - Fuente alternativa de datos de mercado
- **Comunidad React** - Ecosistema asombroso de frontend
- **Docker** - Despliegue simplificado

---

**Construido con ❤️ para inversores que valoran la privacidad y el control**
