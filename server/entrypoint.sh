#!/bin/sh

echo "🚀 Iniciando Stocks Manager Backend..."

# Asegurarse de que el directorio /app/env existe
mkdir -p /app/env

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

# Esperar a que MongoDB esté listo
echo "⏳ Esperando a que MongoDB esté disponible..."
# Intentar con el nombre del servicio primero, luego con el nombre del contenedor
MONGO_HOST="mongo"
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  if nc -z mongo 27017 2>/dev/null; then
    echo "✅ MongoDB está disponible (conectado a 'mongo')"
    break
  elif nc -z stocks-manager-mongo 27017 2>/dev/null; then
    echo "✅ MongoDB está disponible (conectado a 'stocks-manager-mongo')"
    MONGO_HOST="stocks-manager-mongo"
    break
  else
    ATTEMPT=$((ATTEMPT + 1))
    echo "   Intento $ATTEMPT/$MAX_ATTEMPTS: MongoDB no está listo aún, esperando..."
    sleep 2
  fi
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
  echo "⚠️  No se pudo conectar a MongoDB después de $MAX_ATTEMPTS intentos"
  echo "   Continuando de todas formas..."
fi

# Inicializar usuario administrador (si no existe)
echo "👤 Verificando usuario administrador..."
node scripts/initAdmin.js

# Iniciar el servidor
echo "🌐 Iniciando servidor..."
exec node server.js

