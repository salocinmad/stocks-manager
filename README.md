# 📈 Stocks Manager

**Stocks Manager** es un gestor de carteras de inversión personal, diseñado para ofrecer un seguimiento detallado de posiciones, cálculo preciso de PnL (Ganancias/Pérdidas) en EUR, y análisis avanzado de inversiones.

Soporta **múltiples portafolios**, actualizaciones de precios en tiempo real desde múltiples fuentes, snapshots diarios para construir un histórico fiable, y herramientas avanzadas de análisis y reportes.

---

## 🚀 Funcionalidades Principales

### 💼 Sistema Multi-Portafolio
- **Múltiples Carteras**: Organiza tus inversiones en portafolios independientes (ej: "Largo Plazo", "Trading", "Dividendos").
- **Portafolio Favorito**: Marca tu cartera principal para acceso rápido al iniciar sesión.
- **Aislamiento Completo**: Cada portafolio mantiene sus propias operaciones, historial, estadísticas y configuración.
- **Navegación Rápida**: Cambia entre portafolios sin perder el contexto.

### 📊 Dashboard y Análisis
- **Métricas en Tiempo Real**: ROI, Win Rate, Tiempo Medio de Tenencia, Total Invertido, Valor Actual.
- **Gráficos Interactivos**: 
  - Evolución del PnL histórico
  - Distribución de cartera por activo (Pie Chart)
  - Análisis mensual de rendimiento
  - Gráficos de velas OHLC por acción
- **Alertas Inteligentes**: Avisos automáticos sobre:
  - Pérdidas significativas
  - Objetivos de precio alcanzados
  - Riesgos de concentración
- **Reportes Automáticos**: Generación diaria, mensual y anual de estadísticas consolidadas.

### 🔄 Gestión de Operaciones
- **Compra y Venta**: Registro completo de operaciones con fecha, precio, comisiones.
- **Búsqueda de Empresas**: Integración con Finnhub para buscar empresas por nombre.
- **Multi-Divisa**: Soporte para EUR, USD y otras divisas con conversión automática.
- **Símbolos Externos**: Introduce manualmente símbolos no listados en Finnhub.
- **Historial Completo**: Visualiza todas tus operaciones pasadas con filtros y búsqueda.

### 💰 Precios y Datos
- **Multi-Fuente**: Integración con Finnhub (tiempo real) y Yahoo Finance (histórico + divisas).
- **Cache Inteligente**: Sistema de caché para minimizar llamadas API y mejorar rendimiento.
- **Conversión Automática**: Todos los valores se convierten a EUR para cálculo unificado de PnL.
- **Datos Históricos**: Velas OHLC (Open, High, Low, Close) para análisis técnico.
- **Cierre Diario Automático**: Snapshot de todas las posiciones cada madrugada (01:00 AM) para construir histórico.

### 🎨 Personalización
- **Temas**: Modo claro y oscuro con transiciones suaves.
- **Foto de Perfil**: Sube tu avatar personalizado.
- **Botones Externos**: Enlaces rápidos a tus plataformas favoritas (Yahoo Finance, Google Finance, etc.).
- **Notas por Posición**: Añade recordatorios y análisis a cada acción.
- **Ordenamiento**: Organiza tus posiciones según tus preferencias.

### 🛡️ Administración y Seguridad
- **Gestión de Usuarios**: Panel completo para administradores.
- **Autenticación JWT**: Sistema seguro de sesiones con tokens.
- **Panel Admin**: Configuración del sistema, mantenimiento, backup/restore.
- **Scheduler Configurable**: Actualización automática de precios configurable.
- **Backup Completo**: Exporta e importa la base de datos completa (JSON o SQL).

---

## 🛠️ Instalación Rápida

### Requisitos Previos
- Docker y Docker Compose instalados
- Al menos 1GB de RAM disponible
- Puerto 80 libre (configurable)

### Instalación Automática en 2 Pasos

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/salocinmad/stocks-manager.git
   cd stocks-manager
   ```

2. **Iniciar la aplicación**:
   ```bash
   docker compose up -d
   ```

**¡Eso es todo!** 🎉

En el primer arranque, Stocks Manager:
- ✅ Genera automáticamente credenciales seguras para MariaDB
- ✅ Configura la base de datos con hardening de seguridad
- ✅ Crea JWT_SECRET y MASTER_PASSWORD aleatorios
- ✅ Muestra las credenciales generadas en los logs (¡guárdalas!)

3. **Ver credenciales generadas**:
   ```bash
   # Todas las credenciales se muestran juntas en los logs del servidor
   docker compose logs server | grep -A 30 "CREDENCIALES DEL SISTEMA"
   ```
   
   Verás un bloque completo con:
   - Usuario y contraseña de MariaDB
   - JWT_SECRET
   - MASTER_PASSWORD

4. **Acceder a la aplicación**:
   - Abre tu navegador en `http://localhost`
   - Crea tu primer usuario desde la pantalla de login
   - ¡Comienza a gestionar tus inversiones!

> **⚠️ IMPORTANTE**: Guarda la **MASTER_PASSWORD** que aparece en los logs. La necesitarás para recuperar acceso si olvidas la contraseña del admin.

Para instrucciones detalladas de instalación, consulta **[INSTALACION.md](./INSTALACION.md)**.

---

## 📚 Documentación Completa

Esta documentación está organizada en guías especializadas para diferentes usuarios:

- **[📖 Guía de Usuario](./GUIA_USUARIO.md)**: Aprende a usar todas las funcionalidades de Stocks Manager (portafolios, operaciones, análisis, personalización).
- **[🛡️ Guía de Administración](./ADMINISTRACION.md)**: Gestión de usuarios, configuración del sistema, mantenimiento, backup y restauración.
- **[🐳 Guía de Instalación](./INSTALACION.md)**: Instalación detallada, configuración de Docker, variables de entorno y solución de problemas.

---

## 🔧 Stack Tecnológico

### Frontend
- **React 18** con Hooks
- **Vite** para build ultrarrápido
- **Recharts** para gráficos interactivos
- **Lightweight Charts** para velas OHLC avanzadas
- **React Router** para navegación

### Backend
- **Node.js** + **Express**
- **Sequelize ORM** para MySQL/MariaDB
- **bcryptjs** para encriptación de contraseñas
- **JWT** para autenticación
- **Nodemailer** para notificaciones SMTP

### Base de Datos
- **MariaDB 10.11** (compatible con MySQL)
- Sistema de migraciones automáticas
- Backups en JSON y SQL

### APIs Externas
- **Finnhub** para búsqueda de empresas y precios en tiempo real
- **Yahoo Finance v2** para datos históricos y divisas

### Infraestructura
- **Docker Compose** para orquestación
- **Nginx** como proxy inverso
- **Entrypoint scripts** para inicialización automática

---

## 💡 Características Avanzadas

### Sistema de Alertas
- Define precios objetivo para tus acciones
- Recibe notificaciones por email cuando se alcanzan
- Alertas de riesgo de concentración (>30% en un activo)
- Avisos de pérdidas significativas

### Snapshots Diarios
- Captura automática del estado de tu cartera cada noche
- Permite construir gráficos de evolución histórica precisos
- Datos persistentes incluso si borras operaciones

### Reportes Automáticos
- Generación automática tras el cierre diario
- Métricas consolidadas: ROI, Win Rate, Drawdown
- Análisis de contribución por activo
- Exportables a PDF (próximamente)

### Multi-Usuario
- Cada usuario tiene sus propios portafolios
- Los datos están completamente aislados
- Administradores pueden gestionar todos los usuarios

---

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:
1. Haz fork del repositorio
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Añade nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

---

## 📝 Licencia

Este proyecto está licenciado bajo la **Licencia MIT**. Consulta el archivo [LICENSE](./LICENSE) para más detalles.

---

## 🙋 Soporte

¿Problemas? ¿Preguntas? ¿Sugerencias?

- **Issues**: [GitHub Issues](https://github.com/salocinmad/stocks-manager/issues)
- **Documentación**: Revisa las guías en este repositorio
- **Email**: Contacta con el equipo de desarrollo

---

## 🎯 Roadmap

Próximas características planificadas:
- [ ] Exportación de reportes a PDF
- [ ] Integración con más proveedores de datos (Alpha Vantage, IEX Cloud)
- [ ] App móvil (React Native)
- [ ] Sincronización automática con brokers
- [ ] Análisis de dividendos
- [ ] Calculadora fiscal

---

**¡Gracias por usar Stocks Manager!** 🚀📈
