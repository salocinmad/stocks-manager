# Multi-stage Dockerfile for Pure Bun Stack

# Stage 1: Build Frontend
FROM oven/bun:1.2 as builder
WORKDIR /app

# Install dependencies
COPY package.json ./
RUN bun install

# Copy source code
COPY . .

# Build React
RUN bun run build:frontend
# Copy index.html to dist
RUN cp index.html ./dist/index.html
# Copy PWA assets to dist
RUN cp public/manifest.json ./dist/manifest.json
RUN cp public/sw.js ./dist/sw.js
RUN cp public/pwa-192x192.png ./dist/pwa-192x192.png
RUN cp public/pwa-512x512.png ./dist/pwa-512x512.png
RUN cp public/logo-1024.png ./dist/logo-1024.png
RUN cp public/favicon.png ./dist/favicon.png

# Stage 2: Production Runtime
FROM oven/bun:1.2-slim as release
WORKDIR /app

# Copy production modules (if any needed for backend) and built assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
# COPY --from=builder /app/bun.lockb ./
COPY --from=builder /app/server ./server
COPY --from=builder /app/node_modules ./node_modules

# Expose port
EXPOSE 3000

# Start Backend Server (which also serves frontend)
CMD ["bun", "run", "server/index.ts"]
