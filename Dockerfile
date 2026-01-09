# Usar la imagen oficial de Playwright que incluye Node.js y los navegadores necesarios
# Usamos una versión específica que coincide con package.json para evitar problemas
FROM mcr.microsoft.com/playwright:v1.48.1-jammy

# Directorio de trabajo
WORKDIR /app

# Instalar pnpm (si no está disponible en la imagen base)
RUN npm install -g pnpm

# Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml ./

# Instalar dependencias
# PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 evita descargar los navegadores de nuevo
# ya que la imagen base ya los tiene instalados.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN pnpm install --frozen-lockfile

# Copiar el resto del código fuente
COPY . .

# Construir la aplicación TypeScript
RUN pnpm run build

# Definir variables de entorno
ENV NODE_ENV=production

# Comando de inicio
CMD ["node", "dist/main.js"]
