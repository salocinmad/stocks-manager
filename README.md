# Stocks Manager

Bienvenido a **Stocks Manager**, tu solución personal y privada para la gestión profesional de carteras de inversión.

Esta aplicación ha sido diseñada pensando en el inversor particular que desea tener un control absoluto sobre sus datos financieros, sin depender de hojas de cálculo complejas ni ceder su privacidad a plataformas de terceros en la nube.

## 📚 Documentación

*   [Guía de Instalación (INSTALL.md)](./INSTALL.md)
*   [Manual de Usuario (USAGE.md)](./USAGE.md)
*   [Manual de Administración (ADMIN.md)](./ADMIN.md)
*   [Créditos y Agradecimientos (CREDITS.md)](./CREDITS.md)

## ¿Qué es Stocks Manager?

Stocks Manager es una aplicación "autoalojada". Esto significa que funciona dentro de tu propio ordenador o servidor personal. Imagina tener tu propia web de finanzas (como Yahoo Finance o Morningstar) pero funcionando exclusivamente para ti, donde tú eres el único dueño de la información.

### ¿Qué problemas resuelve?

1.  **Caos en Excel:** Olvídate de mantener fórmulas complejas, actualizar precios manualmente o luchar con errores de formato. Stocks Manager lo hace automáticamente.
2.  **Privacidad:** Muchos gestores de cartera online venden datos agregados o exponen tu información financiera. Aquí, tus datos nunca salen de tu máquina.
3.  **Visión Global:** Permite ver todas tus inversiones (acciones, fondos, ETFs) en un solo lugar, unificando diferentes brokers o cuentas.

## Características Destacadas

### 📊 Gestión Integral de Carteras
*   **Múltiples Carteras:** Crea portafolios separados para diferentes objetivos (ej. "Jubilación", "Corto Plazo", "Hijos").
*   **Seguimiento en Tiempo Real:** Visualiza el valor actual, la ganancia/pérdida diaria y total.
*   **Soporte Multi-divisa:** Gestiona activos en Dólares, Euros u otras monedas, con conversión automática a tu moneda base (EUR).

### 🤖 Automatización Inteligente
*   **Precios Automáticos:** Conexión con **Yahoo Finance** y **Finnhub** para actualizar las cotizaciones sin intervención manual.
*   **Cálculos Precisos:** Cálculo automático de precios medios de compra, peso en la cartera y rentabilidad ponderada.

### 🛡️ Seguridad Avanzada
*   **Datos Encriptados:** Las contraseñas se almacenan con encriptación de grado militar.
*   **Autenticación de Dos Factores (2FA):** Añade una capa extra de seguridad usando aplicaciones como Google Authenticator.
*   **Auto-alojamiento:** Tú controlas el servidor y la base de datos.

### 🛠️ Herramientas de Análisis
*   **Gráficos Interactivos:** Evolución histórica de tus activos, distribución por sectores y curvas de rendimiento.
*   **Notas Enriquecidas:** Escribe tesis de inversión o recordatorios usando formato de texto enriquecido (Markdown).
*   **Enlaces Personalizados:** Configura accesos directos a tus fuentes de información favoritas para cada empresa.

## Arquitectura Simplificada (¿Cómo funciona?)

Para los usuarios no técnicos, la aplicación se compone de tres partes que trabajan juntas en tu ordenador:

1.  **La Base de Datos (La Memoria):** Una "caja fuerte" (MariaDB) donde se guardan tus operaciones y usuarios.
2.  **El Servidor (El Cerebro):** Un programa (Node.js) que hace los cálculos, busca los precios en internet y protege tu información.
3.  **La Interfaz (La Pantalla):** La página web que ves en tu navegador, diseñada para ser fácil de usar.

Gracias a la tecnología **Docker**, estas tres partes se instalan y configuran automáticamente como si fueran un solo programa.
