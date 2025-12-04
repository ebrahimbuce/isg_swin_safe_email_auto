import { ImageProcessorService } from '../services/ImageProcessorService.js';
import { HTMLGeneratorService } from '../services/HTMLGeneratorService.js';
import { Logger } from '../services/Logger.js';
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Test para verificar que los niveles de alerta funcionan correctamente
 * Prueba 3 escenarios:
 * 1. Imagen con ROJO → STRONG CURRENTS
 * 2. Imagen con AMARILLO → MODERATE CURRENTS
 * 3. Imagen SIN colores de advertencia → CALM CONDITIONS
 */

async function createTestImage(color: 'red' | 'yellow' | 'none', width: number = 500, height: number = 310): Promise<Buffer> {
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

async function testAlertLevels() {
    const logger = new Logger('info');
    const imageProcessor = new ImageProcessorService(logger);
    const htmlGenerator = new HTMLGeneratorService(logger);

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║     TEST DE NIVELES DE ALERTA - SWIM SAFE PR                ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const testCases = [
        { name: 'ROJO', color: 'red' as const, expectedLevel: 'red', expectedLabel: 'STRONG CURRENTS' },
        { name: 'AMARILLO', color: 'yellow' as const, expectedLevel: 'yellow', expectedLabel: 'MODERATE CURRENTS' },
        { name: 'SIN COLORES', color: 'none' as const, expectedLevel: 'white', expectedLabel: 'CALM CONDITIONS' }
    ];

    for (const testCase of testCases) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🧪 TEST: ${testCase.name}`);
        console.log(`${'='.repeat(60)}\n`);

        try {
            // 1. Crear imagen de prueba
            console.log(`📸 Creando imagen de prueba (${testCase.color})...`);
            const testImage = await createTestImage(testCase.color);

            // 2. Detectar colores
            console.log('🔍 Detectando colores...');
            const detection = await imageProcessor.detectColors(testImage, 0.5);

            console.log(`   🔴 Rojo: ${detection.redPercentage}%`);
            console.log(`   🟡 Amarillo: ${detection.yellowPercentage}%`);

            // 3. Determinar nivel de alerta
            console.log('📊 Determinando nivel de alerta...');
            const alertStatus = htmlGenerator.determineAlertLevel(detection);

            // 4. Verificar resultado
            console.log('\n✅ RESULTADO:');
            console.log(`   Nivel: ${alertStatus.level.toUpperCase()}`);
            console.log(`   Label: ${alertStatus.label}`);
            console.log(`   Descripción: ${alertStatus.description}`);

            // 5. Validar
            const passed = alertStatus.level === testCase.expectedLevel && 
                          alertStatus.label === testCase.expectedLabel;

            if (passed) {
                console.log(`\n✅ TEST PASADO: ${testCase.name}`);
            } else {
                console.log(`\n❌ TEST FALLIDO: ${testCase.name}`);
                console.log(`   Esperado: ${testCase.expectedLevel} - ${testCase.expectedLabel}`);
                console.log(`   Obtenido: ${alertStatus.level} - ${alertStatus.label}`);
            }

            // 6. Guardar imagen de prueba
            const outputPath = path.join(__dirname, `../../public/images/test-${testCase.color}.jpg`);
            await imageProcessor.saveImage(testImage, outputPath);
            console.log(`💾 Imagen guardada: ${outputPath}`);

        } catch (error) {
            console.error(`❌ Error en test ${testCase.name}:`, error);
        }
    }

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║              RESUMEN DE TESTS                                ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    console.log('✅ Tests completados');
    console.log('📁 Imágenes de prueba guardadas en: public/images/');
    console.log('   - test-red.jpg (debería mostrar STRONG CURRENTS)');
    console.log('   - test-yellow.jpg (debería mostrar MODERATE CURRENTS)');
    console.log('   - test-none.jpg (debería mostrar CALM CONDITIONS)');
    console.log('\n');
}

// Ejecutar el test
testAlertLevels().catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
});

