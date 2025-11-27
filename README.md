# 📈 Stocks Manager

**Stocks Manager** es un gestor de carteras de inversión personal, diseñado para ofrecer un seguimiento detallado de posiciones, cálculo preciso de PnL (Ganancias/Pérdidas) en EUR, y análisis avanzado de contribución.

Soporta **múltiples portafolios**, actualizaciones de precios en tiempo real, y snapshots diarios para construir un histórico fiable.

## 🚀 Funcionalidades Principales

### 💼 Gestión de Portafolios
- **Multi-Portafolio**: Organiza tus inversiones en carteras independientes (ej: "Largo Plazo", "Trading", "Ahorros").
- **Favoritos**: Marca tu portafolio principal para acceso rápido.
- **Aislamiento**: Cada portafolio mantiene sus propias operaciones, historial y estadísticas.

### 📊 Análisis Avanzado
- **Dashboard Completo**: ROI, Win Rate, Tiempo de Tenencia, y Crecimiento Mensual.
- **Gráficos Interactivos**: Evolución del PnL, distribución por activo (Pie Chart), y análisis mensual.
- **Alertas Inteligentes**: Avisos automáticos sobre pérdidas significativas, oportunidades de toma de ganancias y riesgos de concentración.
- **Reportes**: Generación de informes diarios, mensuales y anuales.

### 🔄 Precios y Datos
- **Multi-Fuente**: Integración con Finnhub (tiempo real) y Yahoo Finance (cierre/divisas).
- **Multi-Divisa**: Conversión automática de activos en USD a EUR.
- **Cierre Diario**: Snapshot automático de todas las posiciones cada madrugada (01:00 AM) para el histórico.

### 🛡️ Administración
- **Panel de Control**: Gestión de usuarios, configuración del sistema y tareas de mantenimiento.
- **Seguridad**: Autenticación JWT y protección de rutas.

## 🛠️ Instalación Rápida

### Requisitos
- Docker y Docker Compose

### Pasos
1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/salocinmad/stocks-manager.git
   cd stocks-manager
   ```

2. **Configurar entorno**:
   Crea un archivo `.env` (basado en `.env.example`):
   ```env
   MYSQL_USER=portfolio_manager
   MYSQL_PASSWORD=portfolio_manager
   MYSQL_DATABASE=portfolio_manager
   VITE_API_URL=/api
   ```

3. **Iniciar**:
   ```bash
   docker compose up -d
   ```

4. **Acceder**:
   - Web: `http://localhost:80`
   - Usuario inicial: Crea uno nuevo o usa el admin predeterminado.

## 📚 Documentación

Para más detalles, consulta las guías especializadas:

- **[🛡️ Guía de Administración](./ADMINISTRATION.md)**: Gestión de usuarios, restablecimiento de contraseñas, cierre diario y configuración.
- **[🐳 Guía de Infraestructura (Docker)](./DOCKER.md)**: Comandos de Docker, copias de seguridad (Backups), restauración y solución de problemas.

## 🔧 Stack Tecnológico
- **Frontend**: React, Vite, Recharts.
- **Backend**: Node.js, Express, Sequelize.
- **Base de Datos**: MariaDB.
- **Infraestructura**: Docker Compose.
