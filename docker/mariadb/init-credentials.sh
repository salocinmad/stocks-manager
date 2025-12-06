#!/bin/sh
# Script de inicialización de credenciales para MariaDB
# Se ejecuta automáticamente en el primer arranque del contenedor

set -e

CREDENTIALS_FILE="/run/secrets/.credentials_generated"
ENV_FILE="/run/secrets/db_credentials"
DATA_FILE="/var/lib/mysql/.generated_credentials"

# Función para generar contraseña aleatoria segura
generate_password() {
    # Genera una contraseña de 32 caracteres con letras, números y símbolos
    tr -dc 'A-Za-z0-9!@#$%^&*()_+-=' < /dev/urandom | head -c 32
}

# Función para generar usuario aleatorio
generate_username() {
    # Genera un usuario de 10 caracteres (solo letras y números para compatibilidad)
    tr -dc 'a-z0-9' < /dev/urandom | head -c 10
}

mkdir -p /run/secrets

# Determinar fuente de credenciales persistentes
if [ -f "$DATA_FILE" ]; then
    echo "✅ Credenciales ya generadas anteriormente (persistentes), usando las existentes..."
    # Reconstruir archivo de secretos si falta
    if [ ! -f "$ENV_FILE" ]; then
        . "$DATA_FILE" 2>/dev/null || true
        cat > "$ENV_FILE" << EOF
MYSQL_USER="$MYSQL_USER"
MYSQL_PASSWORD="$MYSQL_PASSWORD"
MYSQL_ROOT_PASSWORD="$MYSQL_ROOT_PASSWORD"
MYSQL_DATABASE="$MYSQL_DATABASE"
EOF
        chmod 600 "$ENV_FILE"
    fi
    # Exportar al entorno para el entrypoint oficial
    . "$ENV_FILE"
    export MYSQL_USER MYSQL_PASSWORD MYSQL_ROOT_PASSWORD MYSQL_DATABASE
elif [ -f "$ENV_FILE" ]; then
    echo "✅ Credenciales encontradas en /run/secrets, usando las existentes..."
    . "$ENV_FILE"
    export MYSQL_USER MYSQL_PASSWORD MYSQL_ROOT_PASSWORD MYSQL_DATABASE
    # Crear marcador persistente para impedir regeneración futura
    cat > "$DATA_FILE" << EOF
# Credenciales generadas/restauradas
# Fecha: $(date)
MYSQL_USER=$MYSQL_USER
MYSQL_PASSWORD=$MYSQL_PASSWORD
MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD
MYSQL_DATABASE=$MYSQL_DATABASE
EOF
    chmod 600 "$DATA_FILE"
else
    echo "🔐 Primera instalación detectada - Generando credenciales seguras..."
    # Generar únicamente si no hay credenciales previas
    if [ -z "$MYSQL_USER" ] || [ "$MYSQL_USER" = "user" ]; then
        MYSQL_USER=$(generate_username)
    fi
    if [ -z "$MYSQL_PASSWORD" ] || [ "$MYSQL_PASSWORD" = "password" ]; then
        MYSQL_PASSWORD=$(generate_password)
    fi
    if [ -z "$MYSQL_ROOT_PASSWORD" ] || [ "$MYSQL_ROOT_PASSWORD" = "rootpassword" ]; then
        MYSQL_ROOT_PASSWORD=$(generate_password)
    fi
    export MYSQL_USER MYSQL_PASSWORD MYSQL_ROOT_PASSWORD MYSQL_DATABASE

    echo "DEBUG: MYSQL_USER generado: $MYSQL_USER"
    echo "DEBUG: MYSQL_PASSWORD generado: $(echo "$MYSQL_PASSWORD" | cut -c 1-4)..."
    echo "DEBUG: MYSQL_ROOT_PASSWORD generado: $(echo "$MYSQL_ROOT_PASSWORD" | cut -c 1-4)..."
    echo "DEBUG: MYSQL_DATABASE: $MYSQL_DATABASE"

    # Guardar en secretos (para backend) y en volumen de datos (persistente)
    cat > "$ENV_FILE" << EOF
MYSQL_USER="$MYSQL_USER"
MYSQL_PASSWORD="$MYSQL_PASSWORD"
MYSQL_ROOT_PASSWORD="$MYSQL_ROOT_PASSWORD"
MYSQL_DATABASE="$MYSQL_DATABASE"
EOF
    chmod 600 "$ENV_FILE"

    cat > "$DATA_FILE" << EOF
# Credenciales generadas automáticamente
# Fecha: $(date)
MYSQL_USER=$MYSQL_USER
MYSQL_PASSWORD=$MYSQL_PASSWORD
MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD
MYSQL_DATABASE=$MYSQL_DATABASE
EOF
    chmod 600 "$DATA_FILE"
    touch "$CREDENTIALS_FILE"

    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║  🔐 CREDENCIALES DE BASE DE DATOS GENERADAS AUTOMÁTICAMENTE   ║"
    echo "╠════════════════════════════════════════════════════════════════╣"
    echo "║                                                                ║"
    echo "║  ⚠️  GUARDA ESTAS CREDENCIALES EN UN LUGAR SEGURO ⚠️          ║"
    echo "║                                                                ║"
    echo "║  Usuario MariaDB:      $MYSQL_USER"
    echo "║  Contraseña MariaDB:   $MYSQL_PASSWORD"
    echo "║  Contraseña Root:      $MYSQL_ROOT_PASSWORD"
    echo "║  Base de Datos:        $MYSQL_DATABASE"
    echo "║                                                                ║"
    echo "║  📄 Guardadas en: /run/secrets/db_credentials y volumen de datos ║"
    echo "║                                                                ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
fi

# Continuar con el entrypoint original de MariaDB
exec docker-entrypoint.sh "$@"
