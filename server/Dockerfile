FROM oven/bun:1-alpine

# Configurar timezone española
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Europe/Madrid /etc/localtime && \
    echo "Europe/Madrid" > /etc/timezone && \
    apk del tzdata

# Instalar netcat para verificar conexión
RUN apk add --no-cache netcat-openbsd dos2unix

WORKDIR /app

ENV TZ=Europe/Madrid

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias con Bun
RUN bun install

# Copiar código fuente
COPY . .

# Hacer ejecutable el script de entrada y corregir finales de línea (CRLF -> LF)
RUN dos2unix entrypoint.sh && \
    dos2unix scripts/*.sh || true && \
    chmod +x entrypoint.sh && \
    chmod +x scripts/*.sh || true

# Exponer puerto
EXPOSE 5000

# Usar el script de entrada que inicializa .env y luego inicia el servidor
ENTRYPOINT ["./entrypoint.sh"]

