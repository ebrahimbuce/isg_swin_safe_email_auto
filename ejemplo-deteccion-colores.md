# Detección de Colores en Forecast

## 🎯 Funcionalidad Implementada

El sistema ahora detecta automáticamente la presencia de colores **rojo** y **amarillo** en las imágenes del forecast de riesgo de corrientes marinas.

## ✅ Resultado de la Última Ejecución

```
🟡 PRECAUCIÓN: Se detectó color AMARILLO
   Rojo: 0.02% de la imagen
   Amarillo: 1.08% de la imagen
```

## 🔍 Cómo Funciona

### Detección de Colores

El sistema analiza cada píxel de la imagen y detecta:

**Rojo:**
- R > 150
- R > G * 1.5
- R > B * 1.5

**Amarillo:**
- R > 150
- G > 150
- B < 150
- |R - G| < 50

### Umbral de Detección

Por defecto, se considera que un color está presente si ocupa al menos **0.5%** de la imagen.

## 📊 Uso

### Uso Básico
```typescript
import { ConfigFactory } from './config/ConfigFactory.js';
import { Application } from './services/Application.js';

const config = ConfigFactory.fromEnv();
const app = new Application(config);
await app.bootstrap();
```

### Uso Avanzado
```typescript
const forecastService = app.getForecastService();

// Obtener forecast con detección de colores
const result = await forecastService.getForecast();

console.log('Imagen procesada:', result.imageProcessed);
console.log('Ruta:', result.imagePath);
console.log('Detección:', result.colorDetection);

// Acceder a los resultados
if (result.colorDetection.hasRed) {
    console.log('🔴 ALERTA ROJA detectada');
}

if (result.colorDetection.hasYellow) {
    console.log('🟡 PRECAUCIÓN - Amarillo detectado');
}
```

### Configuración Personalizada
```typescript
const forecastService = app.getForecastService();

// Cambiar valores de recorte
forecastService.setCropValues(100, 100); // top, bottom en píxeles

// Cambiar URL de la imagen
forecastService.setUrl('https://otra-url.com/imagen.jpg');

// Cambiar ruta de salida
forecastService.setOutputPath('./custom/path/image.jpg');
```

### Detección Manual de Colores
```typescript
import { ImageProcessorService } from './services/ImageProcessorService.js';
import { Logger } from './services/Logger.js';
import fs from 'fs';

const logger = new Logger('debug');
const imageProcessor = new ImageProcessorService(logger);

// Cargar imagen
const imageBuffer = fs.readFileSync('./ruta/imagen.jpg');

// Detectar colores con umbral personalizado (1% en este caso)
const detection = await imageProcessor.detectColors(imageBuffer, 1.0);

console.log({
    rojo: detection.hasRed,
    amarillo: detection.hasYellow,
    porcentajeRojo: detection.redPercentage,
    porcentajeAmarillo: detection.yellowPercentage
});
```

## 📋 Interface ColorDetectionResult

```typescript
interface ColorDetectionResult {
    hasRed: boolean;           // true si se detectó rojo significativo
    hasYellow: boolean;        // true si se detectó amarillo significativo
    redPercentage: number;     // Porcentaje de píxeles rojos
    yellowPercentage: number;  // Porcentaje de píxeles amarillos
    totalPixels: number;       // Total de píxeles analizados
}
```

## 🚀 Casos de Uso

### 1. Monitoreo Automático
```typescript
// Ejecutar cada hora
setInterval(async () => {
    const result = await forecastService.getForecast();
    
    if (result.colorDetection.hasRed) {
        // Enviar alerta de peligro
        await sendAlert('PELIGRO', result.colorDetection);
    }
}, 3600000); // Cada hora
```

### 2. API REST
```typescript
app.get('/forecast', async (req, res) => {
    const result = await forecastService.getForecast();
    res.json(result);
});
```

### 3. Notificaciones
```typescript
const result = await forecastService.getForecast();

if (result.colorDetection.hasRed && result.colorDetection.hasYellow) {
    console.log('⚠️ MÁXIMO PELIGRO - Rojo y Amarillo');
} else if (result.colorDetection.hasRed) {
    console.log('🔴 PELIGRO - Corrientes fuertes');
} else if (result.colorDetection.hasYellow) {
    console.log('🟡 PRECAUCIÓN - Condiciones moderadas');
} else {
    console.log('✅ CONDICIONES SEGURAS');
}
```

## 🎨 Ajuste Fino

Si necesitas ajustar la sensibilidad de detección, puedes modificar los parámetros en `ImageProcessorService.ts`:

```typescript
// Ajustar umbral (por defecto 0.5%)
const detection = await imageProcessor.detectColors(image, 2.0); // 2%

// Modificar rangos de detección RGB (en el código fuente)
// Para rojo más estricto: r > 180
// Para amarillo más permisivo: r > 130 && g > 130
```

## 📁 Archivos Generados

- `public/images/forecast.jpg` - Imagen procesada y recortada
- Los logs muestran información detallada del proceso

## 🛠️ Tecnologías Usadas

- **Sharp** - Procesamiento de imágenes
- **Node.js Fetch** - Descarga de imágenes
- **TypeScript** - Type safety
- **Análisis RGB** - Detección pixel por pixel

