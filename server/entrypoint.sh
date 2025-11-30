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

# Esperar a que MariaDB esté listo
echo "⏳ Esperando a que MariaDB esté disponible..."
# Intentar con el nombre del servicio primero
DB_HOST="mariadb"
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  if nc -z mariadb 3306 2>/dev/null; then
    echo "✅ MariaDB está disponible (conectado a 'mariadb')"
    break
  else
    ATTEMPT=$((ATTEMPT + 1))
    echo "   Intento $ATTEMPT/$MAX_ATTEMPTS: MariaDB no está listo aún, esperando..."
    sleep 2
  fi
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
  echo "⚠️  No se pudo conectar a MariaDB después de $MAX_ATTEMPTS intentos"
  echo "   Continuando de todas formas..."
fi

# Inicializar usuario administrador (si no existe)
echo "👤 Verificando usuario administrador..."
node scripts/initAdmin.js

# Ejecutar migraciones de base de datos
echo "🔧 Aplicando migraciones de base de datos..."
node scripts/add_volume_column.js

# Iniciar el servidor
echo "🌐 Iniciando servidor..."
exec node server.js

