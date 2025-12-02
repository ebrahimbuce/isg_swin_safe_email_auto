# Configuración básica Node.js + TypeScript (OOP)

Este ejemplo muestra cómo estructurar una pequeña aplicación de Node.js con TypeScript empleando clases y principios orientados a objetos.

## Scripts disponibles

- `npm run dev`: levanta la app con `tsx watch`, recompila al vuelo y reinicia ante cambios.
- `npm run build`: transpila a JavaScript en `dist/`.
- `npm start`: corre el resultado compilado.

## Estructura de carpetas

- `src/config`: clases que modelan la configuración (`AppConfig`, `EnvironmentConfig`, `ConfigFactory`).
- `src/services`: servicios que consumen la configuración (`Application`).
- `src/main.ts`: punto de entrada donde se crea la configuración y se inicializa la app.

## Variables de entorno soportadas

| Variable            | Descripción                                   | Ejemplo             |
|---------------------|-----------------------------------------------|---------------------|
| `NODE_ENV`          | Ambiente (`development`, `production`, etc.)  | `development`       |
| `APP_NAME`          | Nombre a mostrar en logs                      | `ISG Automatic`     |
| `PORT`              | Puerto HTTP simulado                          | `3000`              |
| `LOG_LEVEL`         | Nivel de log (`debug`, `info`, `warn`, `error`)| `info`              |
| `PUBLIC_DIR`        | Carpeta raíz pública (se crea si no existe)    | `public`            |
| `PUBLIC_IMAGES_DIR` | Carpeta dentro de `PUBLIC_DIR` para imágenes   | `images`            |
| `FEATURE_CACHING`, `FEATURE_METRICS` | Banderas booleanas (`true`/`false`) | `true`              |

## Ejecución

```bash
npm install
npm run dev
```

Modifica las variables de entorno antes de ejecutar para generar configuraciones distintas.

NODE_ENV=production
LOG_LEVEL=info

# Gmail
GMAIL_USER=tu-email@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# Destinatarios (separados por coma)
EMAIL_RECIPIENTS=email1@gmail.com,email2@gmail.com
