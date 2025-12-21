# 📈 Stocks Manager Pro v2

**Stocks Manager Pro** es una aplicación integral y auto-hospedada para el seguimiento de carteras de inversión, diseñada para inversores serios. Combina datos de mercado en tiempo real, análisis avanzados y un Asistente de IA (Gemini) con memoria contextual para ayudarte a tomar mejores decisiones financieras.

![Vista Previa del Dashboard](https://via.placeholder.com/1200x600?text=Dashboard+de+Stocks+Manager) *<!-- Reemplazar con captura de pantalla real -->*

## 🚀 Características Principales

*   **📊 Gestión de Múltiples Carteras:** Realiza el seguimiento de carteras ilimitadas con soporte para múltiples divisas y tipos de activos.
*   **🤖 Asistente Financiero IA:** Chatbot integrado con **Gemini AI** y memoria conversacional. Consulta sobre el riesgo de tu cartera, tendencias de mercado o conceptos financieros.
*   **📉 Gráficos Avanzados:** Gráficos interactivos estilo TradingView para análisis técnico profesional.
*   **⚡ Datos en Tiempo Real:** Integración con **Finnhub** y **Yahoo Finance** para cotizaciones en vivo y datos históricos.
*   **📥 Importación Inteligente:** Importador mediante arrastrar y soltar para extractos de brokers (soporta MyInvestor actualmente).
*   **🔔 Alertas Inteligentes:** Configura alertas de precio y recibe notificaciones vía Email.
*   **🛡️ Análisis de Riesgo:** Desglose visual de la asignación de cartera, exposición a divisas y distribución por sectores.
*   **🌗 Modo Claro/Oscuro:** Interfaz hermosa y responsiva adaptada para operar tanto de día como de noche.
*   **🔒 Privacidad Primero:** Solución auto-hospedada. Tus datos financieros permanecen en tu propio servidor.

## 🛠️ Stack Tecnológico

*   **Frontend:** React 18, TypeScript, Tailwind CSS, Vite.
*   **Backend:** Bun, ElysiaJS (Framework de alto rendimiento).
*   **Base de Datos:** PostgreSQL (vía `postgres.js`).
*   **Contenedores:** Docker y Docker Compose.
*   **IA:** Google Gemini 1.5 Flash mediante el SDK de Google Generative AI.

## 🏁 Primeros Pasos

### Requisitos Previos

*   Docker y Docker Compose.
*   (Opcional) Bun o Node.js para desarrollo local sin Docker.

### Instalación

1.  **Clonar el repositorio:**
    ```bash
    git clone https://github.com/tuusuario/stocks-manager-ver-2.git
    cd stocks-manager-ver-2
    ```

2.  **Configuración del Entorno:**
    Crea un archivo `.env` en el directorio raíz. Puedes copiar el `.env.example` si está disponible.
    ```env
    # Base de Datos
    DB_USER=admin
    DB_PASSWORD=securepassword
    POSTGRES_DB=stocks_manager

    # Seguridad
    JWT_SECRET=tu_clave_secreta_jwt_muy_segura

    # APIs (Gestionadas desde el Panel de Admin, pueden pre-rellenarse aquí)
    FINNHUB_API_KEY=tu_clave_finnhub
    GOOGLE_GENAI_API_KEY=tu_clave_gemini

    # Email (SMTP)
    SMTP_HOST=smtp.gmail.com
    SMTP_PORT=587
    SMTP_USER=tu_correo@gmail.com
    SMTP_PASSWORD=tu_contraseña_de_aplicacion
    ```

3.  **Ejecutar con Docker Compose:**
    ```bash
    docker compose up -d --build
    ```

4.  **Acceder a la Aplicación:**
    Abre tu navegador y navega a `http://localhost:3000`.

### Configuración Inicial

1.  **Registra un nuevo usuario.** El primer usuario suele tener privilegios de Administrador (o establece `role='admin'` en la DB manualmente si es necesario).
2.  Ve a **Administración > Claves API** para configurar tus claves (Finnhub, Google Gemini).
3.  Ve a **Administración > Inteligencia Artificial** para personalizar la personalidad del Chatbot y sus prompts.

## 🤖 Configuración del Asistente IA

Las capacidades de IA funcionan gracias a los modelos Gemini de Google. Puedes personalizar el comportamiento del bot en el Panel de Administración:

*   **Prompt del ChatBot:** Define la personalidad e instrucciones para el agente conversacional.
*   **Prompt de Análisis:** Define cómo debe la IA estructurar los informes detallados de tu cartera.
*   **Variables:** Usa `{{CHAT_HISTORY}}`, `{{MARKET_DATA}}`, `{{PORTFOLIO_CONTEXT}}` para inyectar datos dinámicos en tus prompts.

## 📂 Estructura del Proyecto

```
stocks-manager-ver-2/
├── src/                # Código Frontend (React)
│   ├── components/     # Componentes UI (Gráficos, ChatBot, Formularios)
│   ├── context/        # Contexto de React (Autenticación, Tema)
│   ├── screens/        # Vistas de Páginas (Dashboard, Portfolio, etc.)
│   └── ...
├── server/             # Código Backend (Bun)
│   ├── routes/         # Endpoints de la API (Elysia)
│   ├── services/       # Lógica de Negocio (IA, Datos de Mercado, Alertas)
│   └── index.ts        # Punto de Entrada del Servidor
├── docker-compose.yml  # Orquestación de Contenedores
└── Dockerfile          # Construcción Multi-etapa
```

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Por favor, haz un fork del repositorio y envía un pull request.

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.
