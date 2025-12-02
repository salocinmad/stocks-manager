ARG VITE_API_URL

# Etapa de construcción
FROM node:22-alpine AS build

# Configurar timezone española
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Europe/Madrid /etc/localtime && \
    echo "Europe/Madrid" > /etc/timezone && \
    apk del tzdata

WORKDIR /app

ENV TZ=Europe/Madrid

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar código fuente
COPY . .

# Pasar VITE_API_URL a la fase de construcción de Vite
ENV VITE_API_URL=${VITE_API_URL:-}

# Build de la aplicación
RUN npm run build

# Etapa de producción
FROM nginx:alpine

# Configurar timezone española
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Europe/Madrid /etc/localtime && \
    echo "Europe/Madrid" > /etc/timezone && \
    apk del tzdata

ENV TZ=Europe/Madrid

# Instalar netcat para verificar conectividad
RUN apk add --no-cache netcat-openbsd

# Copiar archivos construidos
COPY --from=build /app/dist /usr/share/nginx/html

# Copiar configuración de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar script de inicio
COPY entrypoint-frontend.sh /entrypoint-frontend.sh
RUN apk add --no-cache dos2unix && \
    dos2unix /entrypoint-frontend.sh && \
    chmod +x /entrypoint-frontend.sh

# Exponer puerto
EXPOSE 80

# Usar script de inicio en lugar de iniciar nginx directamente
ENTRYPOINT ["/entrypoint-frontend.sh"]

