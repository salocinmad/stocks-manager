#!/bin/sh

echo "🚀 Iniciando Stocks Manager Frontend..."

# Esperar a que el backend esté disponible
echo "⏳ Esperando a que el backend esté disponible..."
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  if nc -z server 5000 2>/dev/null; then
    echo "✅ Backend está disponible (conectado a 'server')"
    break
  else
    ATTEMPT=$((ATTEMPT + 1))
    echo "   Intento $ATTEMPT/$MAX_ATTEMPTS: Backend no está listo aún, esperando..."
    sleep 2
  fi
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
  echo "⚠️  No se pudo conectar al backend después de $MAX_ATTEMPTS intentos"
  echo "   Continuando de todas formas..."
fi

# Iniciar Nginx
echo "🌐 Iniciando Nginx..."
exec nginx -g "daemon off;"

