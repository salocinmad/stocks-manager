# Build stage
FROM node:18-alpine AS build

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar código fuente
COPY . .

# Build de la aplicación
RUN npm run build

# Production stage
FROM nginx:alpine

# Instalar netcat para verificar conectividad
RUN apk add --no-cache netcat-openbsd

# Copiar archivos construidos
COPY --from=build /app/dist /usr/share/nginx/html

# Copiar configuración de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar script de inicio
COPY entrypoint-frontend.sh /entrypoint-frontend.sh
RUN chmod +x /entrypoint-frontend.sh

# Exponer puerto
EXPOSE 80

# Usar script de inicio en lugar de iniciar nginx directamente
ENTRYPOINT ["/entrypoint-frontend.sh"]

