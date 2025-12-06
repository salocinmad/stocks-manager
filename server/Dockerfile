FROM node:22-alpine

# Configurar timezone española
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Europe/Madrid /etc/localtime && \
    echo "Europe/Madrid" > /etc/timezone && \
    apk del tzdata

# Instalar netcat para verificar conexión
RUN apk add --no-cache netcat-openbsd

WORKDIR /app

ENV TZ=Europe/Madrid

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar código fuente
COPY . .

# Hacer ejecutable el script de entrada y corregir finales de línea (CRLF -> LF)
# También corregimos otros scripts que puedan necesitarlo
RUN apk add --no-cache dos2unix && \
    dos2unix entrypoint.sh && \
    dos2unix scripts/sync-db-credentials.sh && \
    chmod +x entrypoint.sh && \
    chmod +x scripts/sync-db-credentials.sh

# Exponer puerto
EXPOSE 5000

# Usar el script de entrada que inicializa .env y luego inicia el servidor
ENTRYPOINT ["./entrypoint.sh"]

