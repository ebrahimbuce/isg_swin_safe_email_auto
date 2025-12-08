import { ImageProcessorService } from '../services/ImageProcessorService.js';
import { Logger } from '../services/Logger.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Script de prueba para detección de colores
 * Uso: tsx src/test-color-detection.ts [URL_IMAGEN]
 */
async function testColorDetection() {
  const logger = new Logger('debug');
  const imageProcessor = new ImageProcessorService(logger);

  // URL de imagen de prueba (puedes cambiarla por argumento de línea de comandos)
  const testUrl = process.argv[2] || 'https://www.weather.gov/images/sju/ghwo/RipRiskDay1.jpg';
  const threshold = parseFloat(process.argv[3] || '0.5');

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         TEST DE DETECCIÓN DE COLORES                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Descargar imagen
    logger.info(`Descargando imagen de: ${testUrl}`);
    const image = await imageProcessor.getImage({ url: testUrl });
    logger.info(`✓ Imagen descargada (${(image.length / 1024).toFixed(2)} KB)`);

    // 2. Obtener metadata
    const sharp = (await import('sharp')).default;
    const metadata = await sharp(image).metadata();
    console.log('\n📐 Dimensiones de la imagen:');
    console.log(`   - Ancho: ${metadata.width}px`);
    console.log(`   - Alto: ${metadata.height}px`);
    console.log(`   - Formato: ${metadata.format}`);
    console.log(`   - Canales: ${metadata.channels}`);
    console.log(`   - Total píxeles: ${metadata.width! * metadata.height!}`);

    // 3. Detectar colores
    console.log(`\n🔍 Analizando colores (umbral: ${threshold}%)...`);
    const detection = await imageProcessor.detectColors({ image, threshold });

    // 4. Mostrar resultados
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              RESULTADOS DE DETECCIÓN                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('🔴 ROJO:');
    console.log(`   - Detectado: ${detection.hasRed ? '✅ SÍ' : '❌ NO'}`);
    console.log(`   - Porcentaje: ${detection.redPercentage}%`);
    console.log(
      `   - Píxeles: ${Math.round((detection.redPercentage / 100) * detection.totalPixels).toLocaleString()}`
    );

    console.log('\n🟡 AMARILLO:');
    console.log(`   - Detectado: ${detection.hasYellow ? '✅ SÍ' : '❌ NO'}`);
    console.log(`   - Porcentaje: ${detection.yellowPercentage}%`);
    console.log(
      `   - Píxeles: ${Math.round((detection.yellowPercentage / 100) * detection.totalPixels).toLocaleString()}`
    );

    // 5. Interpretación
    console.log('\n📊 INTERPRETACIÓN:');
    if (detection.hasRed && detection.hasYellow) {
      console.log('   ⚠️  MÁXIMO PELIGRO - Se detectaron ROJO y AMARILLO');
    } else if (detection.hasRed) {
      console.log('   🔴 PELIGRO - Corrientes fuertes detectadas');
    } else if (detection.hasYellow) {
      console.log('   🟡 PRECAUCIÓN - Condiciones moderadas');
    } else {
      console.log('   ✅ SEGURO - No se detectaron colores de advertencia');
    }

    // 6. Guardar imagen de prueba
    const outputPath = path.join(__dirname, '../../public/images/test-detection.jpg');
    await imageProcessor.saveImage({ image, path: outputPath });
    console.log(`\n💾 Imagen guardada en: ${outputPath}`);

    // 7. Test con recorte (opcional)
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║        TEST CON RECORTE (80px arriba, 50px abajo)         ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const croppedImage = await imageProcessor.cropImage({ image, cropTop: 80, cropBottom: 50 });
    const croppedDetection = await imageProcessor.detectColors({ image: croppedImage, threshold });

    console.log('🔴 ROJO (recortado):');
    console.log(`   - Detectado: ${croppedDetection.hasRed ? '✅ SÍ' : '❌ NO'}`);
    console.log(`   - Porcentaje: ${croppedDetection.redPercentage}%`);

    console.log('\n🟡 AMARILLO (recortado):');
    console.log(`   - Detectado: ${croppedDetection.hasYellow ? '✅ SÍ' : '❌ NO'}`);
    console.log(`   - Porcentaje: ${croppedDetection.yellowPercentage}%`);

    // Comparación
    console.log('\n📈 COMPARACIÓN:');
    console.log(
      `   Rojo: ${detection.redPercentage}% → ${croppedDetection.redPercentage}% (${(
        croppedDetection.redPercentage - detection.redPercentage
      ).toFixed(2)}%)`
    );
    console.log(
      `   Amarillo: ${detection.yellowPercentage}% → ${croppedDetection.yellowPercentage}% (${(
        croppedDetection.yellowPercentage - detection.yellowPercentage
      ).toFixed(2)}%)`
    );

    // Guardar imagen recortada
    const croppedOutputPath = path.join(__dirname, '../../public/images/test-detection-cropped.jpg');
    await imageProcessor.saveImage({ image: croppedImage, path: croppedOutputPath });
    console.log(`\n💾 Imagen recortada guardada en: ${croppedOutputPath}`);

    console.log('\n✅ Test completado exitosamente\n');
  } catch (error) {
    logger.error('❌ Error durante el test:', error);
    process.exit(1);
  }
}

// Ejecutar el test
testColorDetection().catch((error) => {
  console.error('Error fatal:', error);
  process.exit(1);
});
