#!/bin/sh
# Script de inicialización de credenciales para MariaDB
# Se ejecuta automáticamente en el primer arranque del contenedor

set -e

CREDENTIALS_FILE="/docker-entrypoint-initdb.d/.credentials_generated"
ENV_FILE="/run/secrets/db_credentials"

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

# Solo generar credenciales en el primer arranque
if [ ! -f "$CREDENTIALS_FILE" ]; then
    echo "🔐 Primera instalación detectada - Generando credenciales seguras..."
    
    # Generar credenciales si no están definidas
    if [ -z "$MYSQL_USER" ] || [ "$MYSQL_USER" = "user" ]; then
        MYSQL_USER=$(generate_username)
        export MYSQL_USER
    fi
    
    if [ -z "$MYSQL_PASSWORD" ] || [ "$MYSQL_PASSWORD" = "password" ]; then
        MYSQL_PASSWORD=$(generate_password)
        export MYSQL_PASSWORD
    fi
    
    if [ -z "$MYSQL_ROOT_PASSWORD" ] || [ "$MYSQL_ROOT_PASSWORD" = "rootpassword" ]; then
        MYSQL_ROOT_PASSWORD=$(generate_password)
        export MYSQL_ROOT_PASSWORD
    fi
    
    # Guardar credenciales generadas en un archivo para que el backend pueda acceder
    mkdir -p /run/secrets
    echo "DEBUG: MYSQL_USER generado: $MYSQL_USER"
    echo "DEBUG: MYSQL_PASSWORD generado: $(echo "$MYSQL_PASSWORD" | cut -c 1-4)..."
    echo "DEBUG: MYSQL_ROOT_PASSWORD generado: $(echo "$MYSQL_ROOT_PASSWORD" | cut -c 1-4)..."
    echo "DEBUG: MYSQL_DATABASE: $MYSQL_DATABASE"
    cat > "$ENV_FILE" << EOF
MYSQL_USER="$MYSQL_USER"
MYSQL_PASSWORD="$MYSQL_PASSWORD"
MYSQL_ROOT_PASSWORD="$MYSQL_ROOT_PASSWORD"
MYSQL_DATABASE="$MYSQL_DATABASE"
EOF
    
    chmod 600 "$ENV_FILE"
    
    # Marcar que ya se generaron las credenciales
    touch "$CREDENTIALS_FILE"
    
    # Mostrar credenciales generadas (solo esta vez)
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
    echo "║  📄 También guardadas en: /run/secrets/db_credentials         ║"
    echo "║                                                                ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    
    # Guardar también en un archivo persistente accesible desde el host
    if [ -d "/var/lib/mysql" ]; then
        cat > "/var/lib/mysql/.generated_credentials" << EOF
# Credenciales generadas automáticamente
# Fecha: $(date)
MYSQL_USER=$MYSQL_USER
MYSQL_PASSWORD=$MYSQL_PASSWORD
MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD
MYSQL_DATABASE=$MYSQL_DATABASE
EOF
        chmod 600 "/var/lib/mysql/.generated_credentials"
        echo "✅ Credenciales guardadas en el volumen: /var/lib/mysql/.generated_credentials"
    fi
else
    echo "✅ Credenciales ya generadas anteriormente, usando las existentes..."
    
    # Cargar credenciales existentes si existen
    if [ -f "$ENV_FILE" ]; then
        . "$ENV_FILE"
    fi
fi

# Continuar con el entrypoint original de MariaDB
exec docker-entrypoint.sh "$@"
