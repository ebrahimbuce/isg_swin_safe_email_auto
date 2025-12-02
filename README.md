# 🌊 Swim Safe Puerto Rico

Sistema automático de alertas de condiciones de playa para Puerto Rico. Descarga imágenes del pronóstico del NWS, detecta niveles de alerta por color, y envía reportes por email.

## ⏰ Horarios de envío automático

| Hora Puerto Rico (AST) | Descripción |
|------------------------|-------------|
| **7:02 AM** | Reporte de la mañana |
| **12:02 PM** | Reporte del mediodía |

## 🚀 Scripts disponibles

```bash
npm run dev          # Desarrollo con hot-reload
npm run build        # Compilar TypeScript
npm run start        # Iniciar en producción
npm run test:cron    # Test de cron jobs
npm run test:flow    # Test del flujo completo
npm run test:email   # Test de envío de email
```

## 🐳 Deploy en Render (Docker)

### 1. Sube a GitHub
```bash
git add .
git commit -m "Deploy to Render"
git push
```

### 2. En Render
1. **New** → **Blueprint** (para usar render.yaml automático)
2. O **New** → **Background Worker** → **Docker**
3. Conecta tu repositorio

### 3. Variables de entorno (configurar en Render)
```
NODE_ENV=production
LOG_LEVEL=info
GMAIL_USER=tu-email@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
EMAIL_RECIPIENTS=email1@gmail.com,email2@gmail.com
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
```

## 📁 Estructura del proyecto

```
├── src/
│   ├── main.ts                 # Punto de entrada
│   ├── config/                 # Configuración
│   └── services/
│       ├── Application.ts      # Aplicación principal
│       ├── ForecastService.ts  # Descarga y procesa forecast
│       ├── EmailService.ts     # Envío de emails
│       ├── SchedulerService.ts # Cron jobs
│       ├── HTMLGeneratorService.ts # Genera imagen
│       └── ImageProcessorService.ts # Detecta colores
├── public/
│   ├── index.html             # Template HTML
│   ├── global.css             # Estilos
│   ├── images/                # Imágenes
│   └── flags/                 # Banderas de alerta
├── Dockerfile                 # Docker con Puppeteer
├── render.yaml                # Config de Render
└── package.json
```

## 🎨 Detección de colores

| Color detectado | Bandera | Significado |
|-----------------|---------|-------------|
| 🔴 Rojo (≥0.01%) | ROJA | Corrientes fuertes - Peligro |
| 🟡 Amarillo (≥0.01%) | AMARILLA | Corrientes moderadas - Precaución |
| Ninguno | BLANCA | Condiciones calmadas - Seguro |

## 🔧 Variables de entorno

| Variable | Requerido | Descripción |
|----------|-----------|-------------|
| `NODE_ENV` | No | `development` o `production` |
| `LOG_LEVEL` | No | `debug`, `info`, `warn`, `error` |
| `GMAIL_USER` | ✅ | Email de Gmail |
| `GMAIL_APP_PASSWORD` | ✅ | App Password de Gmail |
| `EMAIL_RECIPIENTS` | ✅ | Emails separados por coma |
| `PUPPETEER_EXECUTABLE_PATH` | Docker | Ruta a Chrome |

## 📧 Obtener App Password de Gmail

1. Ve a [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Selecciona "Correo" y "Otro (nombre personalizado)"
3. Copia el password de 16 caracteres (sin espacios)

## 🏃 Ejecución local

```bash
# Instalar dependencias
npm install

# Configurar variables (crear archivo .env)
cp .env.example .env
# Editar .env con tus credenciales

# Desarrollo
npm run dev

# Producción
npm run build
npm run start
```
