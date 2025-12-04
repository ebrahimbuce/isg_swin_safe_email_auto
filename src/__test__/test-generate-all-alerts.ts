import { ImageProcessorService } from '../services/ImageProcessorService.js';
import { HTMLGeneratorService } from '../services/HTMLGeneratorService.js';
import { ForecastService } from '../services/ForecastService.js';
import { Logger } from '../services/Logger.js';
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Genera imágenes de output.png para los 3 niveles de alerta
 * Simula la detección de colores y genera la imagen final
 */

async function createTestImage(color: 'red' | 'yellow' | 'white', width: number = 500, height: number = 310): Promise<Buffer> {
    const pixels = width * height;
    const channels = 3; // RGB
    const buffer = Buffer.alloc(pixels * channels);

    for (let i = 0; i < pixels; i++) {
        const offset = i * channels;
        
        if (color === 'red') {
            // Crear imagen con áreas rojas (R alto, G y B bajos)
            if (i % 10 < 3) {
                // 30% de la imagen será roja
                buffer[offset] = 200;     // R alto
                buffer[offset + 1] = 50;  // G bajo
                buffer[offset + 2] = 50;  // B bajo
            } else {
                // Resto azul/verde (océano)
                buffer[offset] = 50;
                buffer[offset + 1] = 150;
                buffer[offset + 2] = 200;
            }
        } else if (color === 'yellow') {
            // Crear imagen con áreas amarillas (R y G altos, B bajo)
            if (i % 10 < 2) {
                // 20% de la imagen será amarilla
                buffer[offset] = 200;     // R alto
                buffer[offset + 1] = 200;  // G alto
                buffer[offset + 2] = 50;   // B bajo
            } else {
                // Resto azul/verde (océano)
                buffer[offset] = 50;
                buffer[offset + 1] = 150;
                buffer[offset + 2] = 200;
            }
        } else {
            // Sin colores de advertencia - solo azul/verde (océano calmado)
            buffer[offset] = 50;
            buffer[offset + 1] = 150;
            buffer[offset + 2] = 200;
        }
    }

    return await sharp(buffer, {
        raw: {
            width,
            height,
            channels: 3
        }
    })
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function generateAllAlertImages() {
    const logger = new Logger('info');
    const imageProcessor = new ImageProcessorService(logger);
    const htmlGenerator = new HTMLGeneratorService(logger);

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║     GENERANDO IMÁGENES PARA TODOS LOS NIVELES DE ALERTA      ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const testCases = [
        { name: 'STRONG CURRENTS (ROJO)', color: 'red' as const, level: 'red' },
        { name: 'MODERATE CURRENTS (AMARILLO)', color: 'yellow' as const, level: 'yellow' },
        { name: 'CALM CONDITIONS (BLANCO)', color: 'white' as const, level: 'white' }
    ];

    for (const testCase of testCases) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🎨 Generando: ${testCase.name}`);
        console.log(`${'='.repeat(60)}\n`);

        try {
            // 1. Crear imagen de prueba simulada
            console.log(`📸 Creando imagen de forecast simulada (${testCase.color})...`);
            const testImage = await createTestImage(testCase.color);

            // 2. Guardar imagen temporal como forecast.jpg
            const forecastPath = path.join(__dirname, '../../public/images/forecast.jpg');
            await imageProcessor.saveImage(testImage, forecastPath);
            console.log(`✅ Imagen guardada: ${forecastPath}`);

            // 3. Detectar colores
            console.log('🔍 Detectando colores...');
            const detection = await imageProcessor.detectColors(testImage, 0.5);
            console.log(`   🔴 Rojo: ${detection.redPercentage}%`);
            console.log(`   🟡 Amarillo: ${detection.yellowPercentage}%`);

            // 4. Actualizar HTML con el estado correcto
            console.log('📝 Actualizando HTML...');
            const alertStatus = await htmlGenerator.updateHTML(detection);
            console.log(`   ✅ Estado: ${alertStatus.label}`);

            // 5. Generar imagen final
            console.log('🖼️  Generando imagen final...');
            const outputPath = path.join(__dirname, `../../public/final/output-${testCase.level}.png`);
            await htmlGenerator.exportToImage(outputPath, 1500, 2500, 'png');
            
            console.log(`\n✅ Imagen generada: ${outputPath}`);
            console.log(`   📊 Estado mostrado: ${alertStatus.label}`);

        } catch (error) {
            console.error(`❌ Error generando ${testCase.name}:`, error);
        }
    }

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║              RESUMEN                                         ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    console.log('✅ Imágenes generadas exitosamente:');
    console.log('   📁 public/final/');
    console.log('      - output-red.png (STRONG CURRENTS)');
    console.log('      - output-yellow.png (MODERATE CURRENTS)');
    console.log('      - output-white.png (CALM CONDITIONS)');
    console.log('\n💡 Puedes abrir estas imágenes para ver cómo se ven los diferentes estados\n');
}

// Ejecutar
generateAllAlertImages().catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
});

