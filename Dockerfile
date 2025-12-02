# ══════════════════════════════════════════════════════════════
# SWIM SAFE PUERTO RICO - Dockerfile para Render
# Node.js + Chrome para Puppeteer
# ══════════════════════════════════════════════════════════════

FROM node:20-slim

# Instalar dependencias del sistema y Chrome
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Instalar Google Chrome
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Verificar instalación de Chrome
RUN google-chrome-stable --version

# Directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias de Node.js
RUN npm ci

# Copiar código fuente
COPY src/ ./src/
COPY public/ ./public/
COPY tsconfig.json ./

# Compilar TypeScript
RUN npm run build

# Crear directorios de salida
RUN mkdir -p /app/public/final /app/public/images

# Limpiar devDependencies
RUN npm prune --production

# Variables de entorno para Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV NODE_ENV=production

# Puerto
EXPOSE 3000

# Comando de inicio
CMD ["node", "dist/main.js"]
