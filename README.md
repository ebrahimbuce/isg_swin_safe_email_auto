# 🌊 Swim Safe Puerto Rico

Sistema automático de alertas de condiciones de playa para Puerto Rico. Descarga imágenes del pronóstico del NWS, detecta niveles de alerta por color, y envía reportes por email.

## ⏰ Horarios de envío automático

| Hora Puerto Rico (AST) | Descripción |
|------------------------|-------------|
| **7:02 AM** | Reporte de la mañana |
| **12:02 PM** | Reporte del mediodía |

*Los envíos son manejados por cron jobs internos (node-cron)*

---

## 🖥️ Deploy en AWS EC2 con PM2

### Paso 1: Crear instancia EC2

1. **En AWS Console** → EC2 → Launch Instance
2. **AMI:** Amazon Linux 2023 o Ubuntu 22.04
3. **Tipo:** t2.micro (gratis) o t2.small
4. **Security Group:** Abrir puerto 22 (SSH)
5. **Key Pair:** Crear o usar existente (.pem)

### Paso 2: Configurar el servidor

```bash
# Conectar al servidor
ssh -i tu-llave.pem ec2-user@TU_IP_PUBLICA

# Copiar y ejecutar script de setup
```

O ejecutar manualmente:

```bash
# Actualizar sistema
sudo yum update -y  # Amazon Linux
# o
sudo apt update && sudo apt upgrade -y  # Ubuntu

# Instalar Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Instalar dependencias de Chrome
sudo yum install -y alsa-lib atk cups-libs gtk3 libXcomposite libXcursor \
    libXdamage libXext libXi libXrandr libXScrnSaver libXtst pango \
    xorg-x11-fonts-100dpi xorg-x11-fonts-75dpi xorg-x11-utils nss libdrm libgbm

# Instalar Google Chrome
wget https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm
sudo yum install -y ./google-chrome-stable_current_x86_64.rpm
rm google-chrome-stable_current_x86_64.rpm

# Instalar PM2
sudo npm install -g pm2

# Crear directorio
sudo mkdir -p /var/www/swim-safe-pr
sudo chown -R $USER:$USER /var/www/swim-safe-pr
```

### Paso 3: Deploy de la aplicación

```bash
# En tu máquina local - compilar
npm run build

# Subir archivos al servidor
scp -i tu-llave.pem -r dist/ public/ package*.json ecosystem.config.cjs \
    ec2-user@TU_IP:/var/www/swim-safe-pr/

# En el servidor
ssh -i tu-llave.pem ec2-user@TU_IP
cd /var/www/swim-safe-pr

# Crear directorio de logs
mkdir -p logs

# Instalar dependencias
npm install --production

# Crear archivo .env
nano .env
```

### Paso 4: Configurar .env

```bash
NODE_ENV=production
LOG_LEVEL=info

# Gmail
GMAIL_USER=tu-email@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# Destinatarios (separados por coma)
EMAIL_RECIPIENTS=email1@gmail.com,email2@gmail.com

# Chromium (Playwright)
PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
# O usar PUPPETEER_EXECUTABLE_PATH para compatibilidad hacia atrás
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
```

### Paso 5: Iniciar con PM2

```bash
# Iniciar aplicación
pm2 start ecosystem.config.cjs

# Guardar configuración
pm2 save

# Configurar inicio automático al reiniciar servidor
pm2 startup
# Ejecutar el comando que muestra PM2
```

### Comandos útiles PM2

```bash
pm2 status              # Ver estado
pm2 logs swim-safe-pr   # Ver logs en tiempo real
pm2 logs swim-safe-pr --lines 100  # Últimas 100 líneas
pm2 restart swim-safe-pr # Reiniciar
pm2 stop swim-safe-pr   # Detener
pm2 delete swim-safe-pr # Eliminar
pm2 monit               # Monitor interactivo
```

---

## 🏃 Ejecución local

```bash
# Instalar dependencias
npm install

# Crear archivo .env
cp scripts/env.example .env
# Editar .env con tus credenciales

# Desarrollo (con hot-reload)
npm run dev

# Producción
npm run build
npm run start
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
| `GMAIL_USER` | ✅ | Email de Gmail |
| `GMAIL_APP_PASSWORD` | ✅ | App Password de Gmail |
| `EMAIL_RECIPIENTS` | ✅ | Emails separados por coma |
| `PLAYWRIGHT_EXECUTABLE_PATH` | Servidor | Ruta a Chromium (o usar `PUPPETEER_EXECUTABLE_PATH` para compatibilidad) |

---

## 📁 Estructura del proyecto

```
├── src/                    # Código fuente TypeScript
├── dist/                   # Código compilado
├── public/                 # HTML, CSS, imágenes, banderas
├── scripts/
│   ├── setup-ec2.sh       # Setup para EC2
│   ├── deploy-ec2.sh      # Deploy automático a EC2
│   └── env.example        # Ejemplo de .env
├── ecosystem.config.cjs   # Configuración PM2
└── package.json
```

---

## 📧 Obtener App Password de Gmail

1. Ve a [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Selecciona "Correo" y "Otro (nombre personalizado)"
3. Copia el password de 16 caracteres (sin espacios)

---

## 🔄 Actualizar aplicación

```bash
# En local
npm run build

# Subir nuevos archivos
scp -i tu-llave.pem -r dist/ ec2-user@TU_IP:/var/www/swim-safe-pr/

# En servidor - reiniciar
ssh -i tu-llave.pem ec2-user@TU_IP "pm2 restart swim-safe-pr"
```
