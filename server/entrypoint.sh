#!/bin/sh

echo "🚀 Iniciando Stocks Manager Backend..."

# Asegurarse de que el directorio /app/env existe
mkdir -p /app/env

# MariaDB sync removido - usando Postgres con variables de entorno
echo "ℹ️  Sync de MariaDB deshabilitado (usando PostgreSQL)"

# Crear el archivo .env si no existe (almacenado en volumen nombrado)
# El archivo se crea dentro del directorio /app/env para evitar problemas con volúmenes
if [ -d /app/env/.env ]; then
  echo "⚠️  /app/env/.env es un directorio, eliminándolo..."
  rm -rf /app/env/.env
fi

if [ ! -f /app/env/.env ]; then
  echo "📝 Creando archivo .env inicial..."
  touch /app/env/.env
  # Dar permisos de escritura
  chmod 666 /app/env/.env
fi

# Crear enlace simbólico desde /app/.env a /app/env/.env para compatibilidad
if [ -L /app/.env ]; then
  rm /app/.env
fi
if [ ! -f /app/.env ] && [ ! -L /app/.env ]; then
  ln -s /app/env/.env /app/.env
  echo "✅ Enlace simbólico creado: /app/.env -> /app/env/.env"
fi

# Ejecutar script de inicialización de .env (solo si no existe o está vacío)
echo "📝 Verificando archivo .env..."
node scripts/init-env.js

# Esperar a que PostgreSQL esté listo
echo "⏳ Esperando a que PostgreSQL esté disponible..."
DB_HOST="postgres"
DB_PORT="5432"
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  if nc -z $DB_HOST $DB_PORT 2>/dev/null; then
    echo "✅ PostgreSQL está disponible (conectado a '$DB_HOST:$DB_PORT')"
    break
  else
    ATTEMPT=$((ATTEMPT + 1))
    echo "   Intento $ATTEMPT/$MAX_ATTEMPTS: PostgreSQL no está listo aún, esperando..."
    sleep 2
  fi
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
  echo "⚠️  No se pudo conectar a PostgreSQL después de $MAX_ATTEMPTS intentos"
  echo "   Continuando de todas formas..."
fi

# Aplicar schema Drizzle (push para dev)
echo "🗄️  Aplicando schema Drizzle (drizzle-kit push:pg)..."
export DATABASE_URL="postgresql://${DB_USER:-user}:${DB_PASS:-password}@${DB_HOST:-postgres}:${DB_PORT:-5432}/${DB_NAME:-portfolio_manager}"
echo "🔗 DATABASE_URL configurado: $DATABASE_URL"
bun run db:push || { echo "❌ FALLO CRÍTICO: drizzle-kit push falló. Saliendo..."; exit 1; }

# Inicializar usuario administrador (si no existe)
echo "👤 Verificando usuario administrador..."
bun scripts/initAdmin.js

# Iniciar el servidor
echo "🌐 Iniciando servidor Bun..."
exec bun server.js

