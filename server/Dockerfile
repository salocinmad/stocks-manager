FROM node:18-alpine

# Instalar netcat para verificar conexión a MongoDB
RUN apk add --no-cache netcat-openbsd

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar código fuente
COPY . .

# Hacer ejecutable el script de entrada
RUN chmod +x entrypoint.sh

# Exponer puerto
EXPOSE 5000

# Usar el script de entrada que inicializa .env y luego inicia el servidor
ENTRYPOINT ["./entrypoint.sh"]

