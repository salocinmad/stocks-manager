#!/bin/sh
# Script de inicialización automática de .env con credenciales de MariaDB
# Se ejecuta en el entrypoint del servidor backend

set -e

echo "🔐 Verificando credenciales de base de datos..."

# Ruta al archivo de credenciales compartido por MariaDB
CREDENTIALS_FILE="/run/secrets/db_credentials"
ENV_FILE="/app/env/.env"

# Esperar a que las credenciales estén disponibles (máximo 30 segundos)
ATTEMPTS=0
MAX_ATTEMPTS=15
while [ ! -f "$CREDENTIALS_FILE" ] && [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
    echo "⏳ Esperando a que MariaDB genere las credenciales... (intento $((ATTEMPTS + 1))/$MAX_ATTEMPTS)"
    sleep 2
    ATTEMPTS=$((ATTEMPTS + 1))
done

if [ -f "$CREDENTIALS_FILE" ]; then
    echo "✅ Credenciales de MariaDB encontradas"
    
    # Leer credenciales generadas por MariaDB
    . "$CREDENTIALS_FILE"
    echo "DEBUG: Credenciales leídas de $CREDENTIALS_FILE"
    echo "DEBUG: MYSQL_USER leído: $MYSQL_USER"
    echo "DEBUG: MYSQL_PASSWORD leído: ${MYSQL_PASSWORD:0:4}..."
    echo "DEBUG: MYSQL_DATABASE leído: $MYSQL_DATABASE"
    
    # Actualizar variables de entorno para esta sesión
    export DB_USER="$MYSQL_USER"
    export DB_PASS="$MYSQL_PASSWORD"
    export DB_NAME="$MYSQL_DATABASE"
    
    # Generar JWT_SECRET si no existe
    if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "your_jwt_secret_key" ]; then
        JWT_SECRET=$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 64)
        export JWT_SECRET
        echo "🔑 JWT_SECRET generado automáticamente"
    fi
    
    # Generar MASTER_PASSWORD si no existe
    if [ -z "$MASTER_PASSWORD" ]; then
        # Generar una frase memorable (6 palabras + números)
        WORD1=$(tr -dc 'A-Z' < /dev/urandom | head -c 1; tr -dc 'a-z' < /dev/urandom | head -c 6)
        WORD2=$(tr -dc '0-9' < /dev/urandom | head -c 1)
        WORD3=$(tr -dc 'A-Z' < /dev/urandom | head -c 1; tr -dc 'a-z' < /dev/urandom | head -c 5)
        WORD4=$(tr -dc '0-9' < /dev/urandom | head -c 1)
        WORD5=$(tr -dc 'A-Z' < /dev/urandom | head -c 1; tr -dc 'a-z' < /dev/urandom | head -c 7)
        WORD6=$(tr -dc '0-9' < /dev/urandom | head -c 1)
        MASTER_PASSWORD="$WORD1$WORD2-$WORD3$WORD4-$WORD5$WORD6"
        export MASTER_PASSWORD
        echo "🔐 MASTER_PASSWORD generado automáticamente"
    fi
    
    # Actualizar o crear .env con las credenciales
    cat > "$ENV_FILE" << EOF
# Configuración de Base de Datos (generada automáticamente)
DB_HOST=mariadb
DB_USER="$MYSQL_USER"
DB_PASS="$MYSQL_PASSWORD"
DB_NAME="$MYSQL_DATABASE"
DB_PORT=3306

# Seguridad (generada automáticamente)
JWT_SECRET="$JWT_SECRET"
MASTER_PASSWORD="$MASTER_PASSWORD"

# Puerto del servidor
PORT=${PORT:-5000}

# API Keys (configurables desde el panel admin)
FINNHUB_API_KEY=${FINNHUB_API_KEY:-}

# Generado automáticamente el: $(date)
EOF
    
    chmod 600 "$ENV_FILE"
    echo "✅ Archivo .env actualizado con credenciales seguras"
    
    # Mostrar mensaje de éxito con TODAS las credenciales (solo si es primera vez)
    if [ ! -f "/app/env/.env_initialized" ]; then
        echo ""
        echo "╔════════════════════════════════════════════════════════════════════╗"
        echo "║                                                                    ║"
        echo "║  🔐  CREDENCIALES DEL SISTEMA GENERADAS AUTOMÁTICAMENTE  🔐       ║"
        echo "║                                                                    ║"
        echo "╠════════════════════════════════════════════════════════════════════╣"
        echo "║                                                                    ║"
        echo "║  ⚠️   GUARDA ESTAS CREDENCIALES EN UN LUGAR SEGURO   ⚠️           ║"
        echo "║                                                                    ║"
        echo "╠════════════════════════════════════════════════════════════════════╣"
        echo "║                                                                    ║"
        echo "║  📦 Base de Datos MariaDB:                                         ║"
        echo "║     • Usuario:           $MYSQL_USER"
        echo "║     • Contraseña:        ${MYSQL_PASSWORD:0:8}...${MYSQL_PASSWORD: -4}"
        echo "║     • Base de Datos:     $MYSQL_DATABASE"
        echo "║                                                                    ║"
        echo "║  🔑 Seguridad:                                                     ║"
        echo "║     • JWT_SECRET:        ${JWT_SECRET:0:16}...${JWT_SECRET: -8}"
        echo "║     • MASTER_PASSWORD:   $MASTER_PASSWORD"
        echo "║                                                                    ║"
        echo "╠════════════════════════════════════════════════════════════════════╣"
        echo "║                                                                    ║"
        echo "║  📄 Credenciales completas guardadas en:                          ║"
        echo "║     • /app/env/.env (dentro del contenedor)                       ║"
        echo "║     • Volumen persistente 'backend_env'                           ║"
        echo "║                                                                    ║"
        echo "║  💡 Para ver credenciales después:                                ║"
        echo "║     docker compose exec server cat /app/env/.env                  ║"
        echo "║                                                                    ║"
        echo "╚════════════════════════════════════════════════════════════════════╝"
        echo ""
        echo "⚠️  IMPORTANTE: La MASTER_PASSWORD es necesaria para recuperar"
        echo "    el acceso de administrador si olvidas tu contraseña."
        echo ""
        
        touch "/app/env/.env_initialized"
    fi
else
    echo "⚠️  No se encontraron credenciales generadas por MariaDB"
    echo "ℹ️  Usando credenciales de variables de entorno o valores por defecto"
    
    # Crear .env con valores de variables de entorno si existen
    cat > "$ENV_FILE" << EOF
# Configuración de Base de Datos
DB_HOST=${DB_HOST:-mariadb}
DB_USER=${DB_USER:-user}
DB_PASS=${DB_PASS:-password}
DB_NAME=${DB_NAME:-portfolio_manager}
DB_PORT=3306

# Seguridad
JWT_SECRET=${JWT_SECRET:-your_jwt_secret_key}
MASTER_PASSWORD=${MASTER_PASSWORD:-}

# Puerto del servidor
PORT=${PORT:-5000}

# API Keys
FINNHUB_API_KEY=${FINNHUB_API_KEY:-}
EOF
    chmod 600 "$ENV_FILE"
fi

echo "✅ Inicialización de credenciales completada"
