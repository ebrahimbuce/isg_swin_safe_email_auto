# ══════════════════════════════════════════════════════════════
# SWIM SAFE PUERTO RICO - Dockerfile para Render
# Compatible con Puppeteer/Chromium
# ══════════════════════════════════════════════════════════════

# Imagen oficial de Puppeteer con Chrome preinstalado
FROM ghcr.io/puppeteer/puppeteer:23.4.0

# Directorio de trabajo
WORKDIR /app

# Usuario root para instalar dependencias
USER root

# Copiar archivos de dependencias (para cache de Docker)
COPY package*.json ./

# Instalar TODAS las dependencias (incluyendo devDependencies para build)
RUN npm ci

# Copiar código fuente y archivos públicos
COPY src/ ./src/
COPY public/ ./public/
COPY tsconfig.json ./

# Compilar TypeScript a JavaScript
RUN npm run build

# Crear directorios de salida y dar permisos
RUN mkdir -p /app/public/final /app/public/images && \
    chown -R pptruser:pptruser /app

# Limpiar devDependencies para reducir tamaño
RUN npm prune --production

# Usuario seguro de Puppeteer
USER pptruser

# ─────────────────────────────────────────────────────────────
# Variables de entorno para Puppeteer
# ─────────────────────────────────────────────────────────────
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV NODE_ENV=production

# Puerto
EXPOSE 3000

# Health check (opcional)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('OK')" || exit 1

# Iniciar aplicación
CMD ["node", "dist/main.js"]
