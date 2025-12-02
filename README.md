# 🌊 Swim Safe Puerto Rico

Sistema automático de alertas de condiciones de playa para Puerto Rico. Descarga imágenes del pronóstico del NWS, detecta niveles de alerta por color, y envía reportes por email.

## ⏰ Horarios de envío

| Hora Puerto Rico (AST) | Descripción |
|------------------------|-------------|
| **7:02 AM** | Reporte de la mañana |
| **12:02 PM** | Reporte del mediodía |

*Los envíos son disparados por cron-job.org*

---

## 🚀 Deploy en Render + cron-job.org

### Paso 1: Deploy en Render

1. **Sube a GitHub:**
```bash
git add .
git commit -m "Deploy to Render"
git push
```

2. **En Render** ([render.com](https://render.com)):
   - **New** → **Web Service**
   - Selecciona **Docker**
   - Conecta tu repositorio

3. **Variables de entorno** (en Render Dashboard):
```
NODE_ENV=production
LOG_LEVEL=info
API_KEY=tu-api-key-secreta
GMAIL_USER=tu-email@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
EMAIL_RECIPIENTS=email1@gmail.com,email2@gmail.com
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
```

4. **Anota tu URL de Render:** `https://swim-safe-pr.onrender.com`

---

### Paso 2: Configurar cron-job.org

1. Ve a [cron-job.org](https://cron-job.org) y crea cuenta gratuita

2. **Crear Cron Job #1 (Mañana):**
   - **Title:** Swim Safe PR - Morning
   - **URL:** `https://tu-app.onrender.com/send?key=TU_API_KEY`
   - **Schedule:** Custom → `2 7 * * *`
   - **Timezone:** America/Puerto_Rico

3. **Crear Cron Job #2 (Mediodía):**
   - **Title:** Swim Safe PR - Noon
   - **URL:** `https://tu-app.onrender.com/send?key=TU_API_KEY`
   - **Schedule:** Custom → `2 12 * * *`
   - **Timezone:** America/Puerto_Rico

---

## 📡 Endpoints HTTP

| Endpoint | Descripción |
|----------|-------------|
| `GET /` | Health check |
| `GET /health` | Health check con info |
| `GET /send?key=API_KEY` | Dispara envío de email |

---

## 🏃 Ejecución local

```bash
# Instalar dependencias
npm install

# Configurar variables (crear archivo .env)
NODE_ENV=development
LOG_LEVEL=info
API_KEY=test-key
GMAIL_USER=tu-email@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
EMAIL_RECIPIENTS=tu-email@gmail.com

# Desarrollo
npm run dev

# Probar envío manual
curl "http://localhost:3000/send?key=test-key"
```

---

## 🚀 Scripts disponibles

```bash
npm run dev          # Desarrollo con hot-reload
npm run build        # Compilar TypeScript
npm run start        # Iniciar servidor HTTP
npm run test:flow    # Test del flujo completo
npm run test:email   # Test de envío de email
```

---

## 🎨 Detección de colores

| Color detectado | Bandera | Significado |
|-----------------|---------|-------------|
| 🔴 Rojo (≥0.01%) | ROJA | Corrientes fuertes - Peligro |
| 🟡 Amarillo (≥0.01%) | AMARILLA | Corrientes moderadas - Precaución |
| Ninguno | BLANCA | Condiciones calmadas - Seguro |

---

## 🔧 Variables de entorno

| Variable | Requerido | Descripción |
|----------|-----------|-------------|
| `NODE_ENV` | No | `development` o `production` |
| `LOG_LEVEL` | No | `debug`, `info`, `warn`, `error` |
| `PORT` | No | Puerto HTTP (default: 3000) |
| `API_KEY` | ✅ | Clave para proteger `/send` |
| `GMAIL_USER` | ✅ | Email de Gmail |
| `GMAIL_APP_PASSWORD` | ✅ | App Password de Gmail |
| `EMAIL_RECIPIENTS` | ✅ | Emails separados por coma |
| `PUPPETEER_EXECUTABLE_PATH` | Docker | Ruta a Chrome |

---

## 📧 Obtener App Password de Gmail

1. Ve a [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Selecciona "Correo" y "Otro (nombre personalizado)"
3. Copia el password de 16 caracteres (sin espacios)

---

## 📁 Estructura del proyecto

```
├── src/
│   ├── main.ts                 # Servidor HTTP + endpoints
│   ├── config/                 # Configuración
│   └── services/
│       ├── Application.ts      # Aplicación principal
│       ├── ForecastService.ts  # Descarga y procesa forecast
│       ├── EmailService.ts     # Envío de emails
│       └── HTMLGeneratorService.ts # Genera imagen
├── public/
│   ├── index.html             # Template HTML
│   └── flags/                 # Banderas de alerta
├── Dockerfile                 # Docker con Puppeteer
└── render.yaml                # Config de Render
```
