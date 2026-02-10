# 🌊 Swim Safe Puerto Rico

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-24.11.1-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6.3-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

Sistema automático e inteligente de monitoreo y alertas de condiciones de playa para Puerto Rico. Analiza en tiempo real las imágenes del pronóstico del National Weather Service (NWS), detecta automáticamente los niveles de peligro mediante análisis de colores, genera reportes visuales personalizados y distribuye alertas por email de forma programada.

## 📋 Tabla de Contenidos

- [Características](#-características-principales)
- [Arquitectura](#-arquitectura-del-sistema)
- [Tecnologías](#-tecnologías-utilizadas)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Uso](#-uso)
- [Tests](#-tests)
- [Deploy](#-deploy-en-aws-ec2)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Documentación Adicional](#-documentación-adicional)

## 🎯 Características Principales

### 🤖 Automatización Completa

- **Ejecución programada** mediante cron jobs internos (7:02 AM y 12:02 PM AST)
- **Sistema de preview** 15 minutos antes del envío principal (6:45 AM y 11:45 AM)
- **Procesamiento autónomo** sin intervención manual
- **Recuperación de errores** con logging detallado

### 🎨 Análisis Inteligente de Imágenes

- **Detección de colores avanzada** utilizando Sharp y algoritmos de procesamiento
- **Identificación automática** de banderas rojas y amarillas
- **Análisis por píxeles** con umbrales configurables (HSV color space)
- **Recorte inteligente** para eliminar áreas irrelevantes
- **Caché de imágenes** para optimización de rendimiento

### 📧 Sistema de Notificaciones

- **Emails HTML personalizados** con diseño responsivo
- **Imágenes embebidas** optimizadas y comprimidas
- **Envíos paralelos** para múltiples destinatarios
- **Connection pooling** para eficiencia en SMTP
- **Reintentos automáticos** en caso de fallos

### 📊 Generación de Reportes Visuales

- **Captura de screenshots** con Playwright/Chromium
- **Composición HTML dinámica** con información actualizada
- **Exportación a imágenes** en formato PNG optimizado
- **Dimensiones adaptativas** (1200x2500px por defecto)
- **Compresión automática** para reducir tamaño

### 🔒 Seguridad y Confiabilidad

- **Variables de entorno** para credenciales sensibles
- **Validación de configuración** en tiempo de ejecución
- **Logging estructurado** con niveles configurables
- **Manejo robusto de errores** en toda la aplicación

## 🏗️ Arquitectura del Sistema

El sistema sigue una **arquitectura orientada a servicios** (SOA) con **inyección de dependencias** y **separación de responsabilidades**. Ver [ARCHITECTURE.md](ARCHITECTURE.md) para detalles completos.

### Componentes Principales

```
┌─────────────────────────────────────────────────────────────┐
│                      Application                            │
│                  (Orchestrator Layer)                       │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌───────────────┐     ┌──────────────┐
│   Scheduler   │     │    Email     │
│   Service     │────▶│   Service    │
└───────────────┘     └──────┬───────┘
                             │
                    ┌────────┼────────┐
                    ▼        ▼        ▼
            ┌───────────┬─────────┬──────────────┐
            │ Forecast  │  HTML   │   Image      │
            │  Service  │ Email   │  Processor   │
            │           │ Gen.    │   Service    │
            └───────────┴─────────┴──────────────┘
                    │
                    ▼
            ┌──────────────┐
            │     HTML     │
            │  Generator   │
            │   Service    │
            └──────────────┘
```

### Flujo de Ejecución

1. **Scheduler Service** activa el job según cron schedule
2. **Application** coordina la ejecución del flujo principal
3. **Forecast Service** descarga y analiza la imagen del NWS
4. **Image Processor** detecta colores y procesa la imagen
5. **HTML Generator** crea la visualización con los datos
6. **HTML Email Generator** compone el email personalizado
7. **Email Service** distribuye los reportes a los destinatarios

### DTOs (Data Transfer Objects)

El sistema utiliza interfaces TypeScript para tipado fuerte:

- **EmailDTO**: Configuración y parámetros de emails
- **ImageProcessorDTO**: Parámetros de procesamiento de imágenes
- **ForecastDTO**: Datos del pronóstico y resultados
- **HTMLGeneratorDTO**: Configuración de generación HTML
- **BrowserDTO**: Configuración de Playwright

## 💻 Tecnologías Utilizadas

### Core

- **Node.js** v24.11.1 - Runtime JavaScript
- **TypeScript** v5.6.3 - Tipado estático
- **ES Modules** - Sistema de módulos moderno

### Librerías Principales

- **Playwright** - Automatización de navegador (Chromium)
- **Sharp** - Procesamiento avanzado de imágenes
- **Nodemailer** - Envío de emails vía SMTP
- **node-cron** - Programación de tareas (cron jobs)
- **dotenv** - Gestión de variables de entorno

### Herramientas de Desarrollo

- **tsx** - Ejecución directa de TypeScript
- **PM2** - Process manager para producción
- **pnpm** - Gestor de paquetes eficiente

### Infraestructura

- **AWS EC2** - Servidor de producción
- **Amazon Linux 2023** - Sistema operativo
- **Google Chrome Headless** - Renderizado de HTML

## 🚀 Instalación

### Requisitos Previos

- **Node.js** >= 20.0.0 (recomendado v24.11.1)
- **pnpm** >= 8.0.0 (o npm/yarn)
- **Git** para clonar el repositorio
- **Gmail** con App Password habilitado

### Pasos de Instalación

1. **Clonar el repositorio**

```bash
git clone https://github.com/ebrahimbuce/isg_swin_safe_email_auto.git
cd isg_swin_safe_email_auto
```

2. **Instalar dependencias**

```bash
pnpm install
# o
npm install
```

3. **Instalar Playwright browsers**

```bash
npx playwright install chromium
```

4. **Configurar variables de entorno**

```bash
cp .env.example .env
nano .env  # o tu editor preferido
```

5. **Compilar TypeScript** (opcional, para producción)

```bash
pnpm run build
```

## ⚙️ Configuración

### Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```bash
# Entorno
NODE_ENV=development              # development | production
LOG_LEVEL=info                    # debug | info | warn | error

# Gmail (SMTP)
GMAIL_USER=tu-email@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# Destinatarios principales (separados por coma)
EMAIL_RECIPIENTS=user1@example.com,user2@example.com,user3@example.com

# Email para previews (15 minutos antes)
PREVIEW_EMAILS=preview@example.com

# Puerto (opcional, para modo HTTP)
PORT=3000
```

### Obtener Gmail App Password

1. Ve a tu cuenta de Google → Seguridad
2. Habilita **Verificación en 2 pasos**
3. Busca **Contraseñas de aplicaciones**
4. Genera una nueva contraseña para "Correo"
5. Copia la contraseña de 16 caracteres generada
6. Pégala en `GMAIL_APP_PASSWORD` (con o sin espacios)

### Configuración de Horarios

Los horarios están configurados en `src/services/SchedulerService.ts`:

```typescript
// Envíos principales
'2 7,12 * * *'; // 7:02 AM y 12:02 PM AST

// Previews
'45 6,11 * * *'; // 6:45 AM y 11:45 AM AST
```

**Zona horaria**: `America/Puerto_Rico` (Atlantic Standard Time - AST)

## 📖 Uso

### Modo Desarrollo

**Ejecutar con hot-reload:**

```bash
pnpm run dev
```

La aplicación iniciará los cron jobs y esperará los horarios programados.

### Modo Producción

**Compilar y ejecutar:**

```bash
pnpm run build
pnpm run start:prod
```

**Con PM2 (recomendado):**

```bash
pm2 start ecosystem.config.cjs
pm2 logs swim-safe-pr
```

### Ejecución Manual

**Enviar forecast inmediatamente:**

```bash
# En desarrollo
pnpm run dev -- --once

# En producción
node dist/main.js --once
```

## 🧪 Tests

El proyecto incluye una suite completa de tests:

### Tests Disponibles

```bash
# Test completo sin envío de email
pnpm run test:flow:no-email

# Test de detección de colores
pnpm run test:colors

# Test de niveles de alerta
pnpm run test:alerts

# Test de generación de todas las alertas
pnpm run test:generate-alerts

# Test de envío de email (requiere configuración)
pnpm run test:email

# Test completo con email (solo PREVIEW_EMAILS)
pnpm run test:flow

# Test de cron jobs
pnpm run test:cron

# Verificar tipos TypeScript
pnpm run lint
```

### Ejemplos de Uso

**Test de detección de colores:**

```bash
# Con imagen por defecto
pnpm run test:colors

# Con imagen personalizada
pnpm run test:colors https://ejemplo.com/imagen.jpg

# Con umbral personalizado (1.5%)
pnpm run test:colors https://ejemplo.com/imagen.jpg 1.5
```

**Test de envío de email:**

```bash
# Enviar a PREVIEW_EMAILS del .env
pnpm run test:email

# Enviar a email específico
pnpm run test:email tu-email@gmail.com
```

**Test de flujo completo:**

```bash
# Sin envío de email (solo procesamiento)
pnpm run test:flow:no-email

# Con envío a PREVIEW_EMAILS
pnpm run test:flow
```

### Resultados Esperados

Los tests generan imágenes en `public/`:

- `public/images/forecast.jpg` - Imagen descargada del NWS
- `public/images/test-*.jpg` - Imágenes de prueba
- `public/final/output.png` - Reporte visual generado
- `public/final/output-*.png` - Variantes de alertas

## 📦 Deploy en AWS EC2

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

| Color detectado      | Bandera  | Significado                       |
| -------------------- | -------- | --------------------------------- |
| 🔴 Rojo (≥0.01%)     | ROJA     | Corrientes fuertes - Peligro      |
| 🟡 Amarillo (≥0.01%) | AMARILLA | Corrientes moderadas - Precaución |
| Ninguno              | BLANCA   | Condiciones calmadas - Seguro     |

---

## 🔧 Variables de entorno

| Variable                     | Requerido | Descripción                                                              |
| ---------------------------- | --------- | ------------------------------------------------------------------------ |
| `NODE_ENV`                   | No        | `development` o `production`                                             |
| `LOG_LEVEL`                  | No        | `debug`, `info`, `warn`, `error`                                         |
| `GMAIL_USER`                 | ✅        | Email de Gmail                                                           |
| `GMAIL_APP_PASSWORD`         | ✅        | App Password de Gmail                                                    |
| `EMAIL_RECIPIENTS`           | ✅        | Emails separados por coma                                                |
| `PLAYWRIGHT_EXECUTABLE_PATH` | Servidor  | Ruta a Chromium (o usar `PUPPETEER_EXECUTABLE_PATH` para compatibilidad) |

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
