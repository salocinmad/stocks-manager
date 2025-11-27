# Stocks Manager

Gestor de carteras de inversión personal diseñado para el seguimiento de posiciones, cálculo de PnL en EUR, y análisis de contribución. Soporta múltiples portafolios por usuario, actualizaciones de precios en tiempo real y snapshots diarios para el histórico.

## 🚀 Funcionalidades Principales

### 💼 Gestión de Portafolios (¡Nuevo!)
- **Múltiples Portafolios**: Crea, renombra y elimina portafolios independientes para organizar tus inversiones (ej: "Largo Plazo", "Trading", "Ahorros").
- **Portafolio Favorito**: Marca un portafolio como favorito para que se abra automáticamente al iniciar sesión.
- **Datos Independientes**: Cada portafolio mantiene sus propias operaciones, historial de PnL y estadísticas.

### 📊 Seguimiento y Análisis
- **Posiciones Activas**: Vista clara de tus acciones con cálculo de Ganancia/Pérdida en EUR.
- **Gráficos Interactivos**:
  - **Evolución PnL**: Histórico de ganancias/pérdidas de los últimos 30 días (independiente por portafolio).
  - **Contribución**: Gráfico circular que muestra el peso de cada empresa en tu cartera.
- **Multi-divisa**: Soporte automático para acciones en USD (conversión a EUR usando tipo de cambio actual).

### 🔄 Precios y Actualizaciones
- **Fuentes de Datos**:
  - **Finnhub**: Precios en tiempo real (requiere API Key).
  - **Yahoo Finance**: Precios de cierre y tipos de cambio (EURUSD).
  - **Caché**: Sistema inteligente para minimizar llamadas a APIs externas.
- **Cierre Diario**:
  - **Automático**: Se ejecuta cada madrugada (01:00 hora España) para guardar el histórico.
  - **Manual**: Botón "Forzar PnL último día" en el panel de Admin para recalcular el cierre bajo demanda.

### 🛡️ Administración y Seguridad
- **Panel de Admin**: Configuración del sistema, gestión de tareas programadas y herramientas de mantenimiento.
- **Backups**: Comandos Docker integrados para realizar copias de seguridad y restauración completa.

## 🛠️ Instalación y Despliegue

### Requisitos
- Docker y Docker Compose

### Pasos Rápidos
1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/salocinmad/stocks-manager.git
   cd stocks-manager
   ```

2. **Configurar variables de entorno**:
   Crea un archivo `.env` (puedes copiar `.env.example` si existe) con:
   ```env
   MYSQL_USER=portfolio_manager
   MYSQL_PASSWORD=portfolio_manager
   MYSQL_DATABASE=portfolio_manager
   VITE_API_URL=/api
   ```

3. **Arrancar con Docker**:
   ```bash
   docker compose up -d
   ```

4. **Acceder**:
   - Web: `http://localhost:80` (o el puerto configurado)
   - Usuario inicial: Crea uno nuevo o usa el admin si ya está configurado.

> Para instrucciones detalladas sobre Docker, comandos de mantenimiento y solución de problemas, consulta [DOCKER.md](./DOCKER.md).

## 📚 Guías de Administración

Para tareas avanzadas como restablecer la contraseña de administrador, gestión de backups o configuración del scheduler, consulta la guía unificada:

👉 **[Guía de Administración (ADMINISTRATION.md)](./ADMINISTRATION.md)**

## 🔧 Arquitectura Técnica
- **Frontend**: React + Vite + Recharts (Modo Oscuro/Claro automático).
- **Backend**: Node.js + Express.
- **Base de Datos**: MariaDB con Sequelize ORM.
- **Contenedores**: Docker Compose para orquestación completa.
