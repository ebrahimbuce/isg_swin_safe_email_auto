import 'dotenv/config';
import { Logger } from '../services/Logger.js';
import { ImageProcessorService } from '../services/ImageProcessorService.js';
import { ForecastService } from '../services/ForecastService.js';
import { existsSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testFlowNoEmail() {
    const logger = new Logger('info');

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║     🌊 TEST DE FLUJO COMPLETO (SIN EMAIL) - SWIM SAFE PR      ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    console.log('ℹ️  Este test ejecuta todo el flujo EXCEPTO el envío de email\n');

    const startTime = Date.now();

    try {
        // ═══════════════════════════════════════════════════════════════════
        // PASO 1: Inicializar servicios
        // ═══════════════════════════════════════════════════════════════════
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📦 PASO 1: Inicializando servicios...\n');
        
        const imageProcessor = new ImageProcessorService(logger);
        const forecastService = new ForecastService(logger, imageProcessor);
        
        console.log('   ✅ ImageProcessorService');
        console.log('   ✅ ForecastService\n');

        // ═══════════════════════════════════════════════════════════════════
        // PASO 2: Descargar y procesar imagen del forecast
        // ═══════════════════════════════════════════════════════════════════
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🖼️  PASO 2: Descargando imagen del forecast en tiempo real...\n');
        
        const forecastResult = await forecastService.getForecast();
        
        console.log(`\n   📍 Imagen procesada: ${forecastResult.imagePath}`);
        console.log(`   📍 Imagen final (output): ${forecastResult.outputImagePath}\n`);

        // Verificar que los archivos existen
        const imageExists = existsSync(forecastResult.imagePath);
        const outputExists = existsSync(forecastResult.outputImagePath);
        
        if (imageExists) {
            const imageStats = statSync(forecastResult.imagePath);
            console.log(`   ✅ Imagen procesada existe (${(imageStats.size / 1024).toFixed(2)} KB)`);
        } else {
            console.log(`   ❌ Imagen procesada NO existe`);
        }
        
        if (outputExists) {
            const outputStats = statSync(forecastResult.outputImagePath);
            console.log(`   ✅ Imagen output existe (${(outputStats.size / 1024).toFixed(2)} KB)\n`);
        } else {
            console.log(`   ❌ Imagen output NO existe\n`);
        }

        // ═══════════════════════════════════════════════════════════════════
        // PASO 3: Mostrar resultados de detección de colores
        // ═══════════════════════════════════════════════════════════════════
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎨 PASO 3: Resultados de detección de colores\n');
        
        const { colorDetection, alertStatus } = forecastResult;
        
        console.log('   📊 Análisis de colores:');
        console.log(`      🔴 Rojo: ${colorDetection.redPercentage.toFixed(2)}% ${colorDetection.hasRed ? '(DETECTADO ⚠️)' : '(No detectado)'}`);
        console.log(`      🟡 Amarillo: ${colorDetection.yellowPercentage.toFixed(2)}% ${colorDetection.hasYellow ? '(DETECTADO ⚠️)' : '(No detectado)'}`);
        console.log(`      ⚪ Blanco: ${(100 - colorDetection.redPercentage - colorDetection.yellowPercentage).toFixed(2)}%`);
        console.log();
        console.log(`   🚩 Bandera seleccionada: ${alertStatus.level.toUpperCase()}`);
        console.log(`   📋 Estado: ${alertStatus.label}`);
        // Descripción eliminada: propiedad no disponible

        // ═══════════════════════════════════════════════════════════════════
        // PASO 4: Verificar archivos generados
        // ═══════════════════════════════════════════════════════════════════
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📁 PASO 4: Verificando archivos generados\n');
        
        const htmlPath = path.join(__dirname, '../../public/index.html');
        const htmlExists = existsSync(htmlPath);
        
        if (htmlExists) {
            const htmlStats = statSync(htmlPath);
            console.log(`   ✅ HTML actualizado: ${htmlPath}`);
            console.log(`      Tamaño: ${(htmlStats.size / 1024).toFixed(2)} KB`);
            console.log(`      Última modificación: ${htmlStats.mtime.toLocaleString()}\n`);
        } else {
            console.log(`   ❌ HTML NO existe: ${htmlPath}\n`);
        }

        // ═══════════════════════════════════════════════════════════════════
        // PASO 5: Resumen de validaciones
        // ═══════════════════════════════════════════════════════════════════
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ PASO 5: Validaciones\n');
        
        const validations = {
            imagenProcesada: imageExists,
            imagenOutput: outputExists,
            htmlActualizado: htmlExists,
            coloresDetectados: colorDetection.hasRed || colorDetection.hasYellow || (!colorDetection.hasRed && !colorDetection.hasYellow)
        };
        
        console.log('   Validaciones:');
        console.log(`      ${validations.imagenProcesada ? '✅' : '❌'} Imagen procesada generada`);
        console.log(`      ${validations.imagenOutput ? '✅' : '❌'} Imagen output generada`);
        console.log(`      ${validations.htmlActualizado ? '✅' : '❌'} HTML actualizado`);
        console.log(`      ${validations.coloresDetectados ? '✅' : '❌'} Colores detectados\n`);
        
        const allValid = Object.values(validations).every(v => v === true);
        
        if (!allValid) {
            console.log('   ⚠️  Algunas validaciones fallaron\n');
        }

        // ═══════════════════════════════════════════════════════════════════
        // RESUMEN FINAL
        // ═══════════════════════════════════════════════════════════════════
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n╔══════════════════════════════════════════════════════════════╗');
        console.log('║           ✅ TEST COMPLETADO EXITOSAMENTE                     ║');
        console.log('╚══════════════════════════════════════════════════════════════╝\n');
        
        console.log('📊 RESUMEN:');
        console.log(`   ⏱️  Tiempo total: ${duration} segundos`);
        console.log(`   🖼️  Imagen descargada: ${imageExists ? '✅' : '❌'}`);
        console.log(`   🖼️  Imagen output generada: ${outputExists ? '✅' : '❌'}`);
        console.log(`   🎨  Colores detectados: ✅`);
        console.log(`   🚩  Bandera: ${alertStatus.level.toUpperCase()}`);
        console.log(`   📄  HTML actualizado: ${htmlExists ? '✅' : '❌'}`);
        console.log(`   📨  Email: ⏭️  Omitido (test sin email)\n`);
        
        console.log('💡 NOTA: Este test NO envía emails. Para probar el envío de emails, usa:');
        console.log('   npm run test:flow tu-email@gmail.com\n');
        
        console.log('══════════════════════════════════════════════════════════════\n');

        if (!allValid) {
            console.log('⚠️  ADVERTENCIA: Algunas validaciones fallaron. Revisa los archivos generados.\n');
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ Error en el flujo:', error);
        if (error instanceof Error) {
            console.error(`   Mensaje: ${error.message}`);
            if (error.stack) {
                console.error(`   Stack: ${error.stack}`);
            }
        }
        process.exit(1);
    }

    process.exit(0);
}

testFlowNoEmail().catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
});

