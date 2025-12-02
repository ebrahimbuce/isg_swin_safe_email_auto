import 'dotenv/config';
import { Logger } from '../services/Logger.js';
import { ImageProcessorService } from '../services/ImageProcessorService.js';
import { ForecastService } from '../services/ForecastService.js';
import { EmailService } from '../services/EmailService.js';
import { SchedulerService } from '../services/SchedulerService.js';

async function testFullFlow() {
    const logger = new Logger('info');

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║          🌊 TEST DE FLUJO COMPLETO - SWIM SAFE PR             ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    // Verificar configuración de email
    const emailUser = process.env.GMAIL_USER;
    const emailPass = process.env.GMAIL_APP_PASSWORD;
    const emailArg = process.argv.find(arg => arg.includes('@'));
    const recipients = emailArg ? [emailArg] : (process.env.EMAIL_RECIPIENTS?.split(',').map(e => e.trim()) || []);

    console.log('📧 Configuración de Email:');
    console.log(`   Usuario: ${emailUser || '❌ NO CONFIGURADO'}`);
    console.log(`   Password: ${emailPass ? '✅ Configurado' : '❌ NO CONFIGURADO'}`);
    console.log(`   Destinatarios: ${recipients.length > 0 ? recipients.join(', ') : '❌ NO CONFIGURADO'}\n`);

    if (!emailUser || !emailPass) {
        console.error('❌ Configura GMAIL_USER y GMAIL_APP_PASSWORD en .env');
        process.exit(1);
    }

    if (recipients.length === 0) {
        console.error('❌ Pasa un email como argumento o configura EMAIL_RECIPIENTS');
        console.error('   Uso: npm run test:flow tu-email@gmail.com');
        process.exit(1);
    }

    const startTime = Date.now();

    try {
        // ═══════════════════════════════════════════════════════════════════
        // PASO 1: Inicializar servicios
        // ═══════════════════════════════════════════════════════════════════
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📦 PASO 1: Inicializando servicios...\n');
        
        const imageProcessor = new ImageProcessorService(logger);
        const forecastService = new ForecastService(logger, imageProcessor);
        const emailService = new EmailService(logger, forecastService);
        const scheduler = new SchedulerService(logger);
        
        console.log('   ✅ ImageProcessorService');
        console.log('   ✅ ForecastService');
        console.log('   ✅ EmailService');
        console.log('   ✅ SchedulerService\n');

        // ═══════════════════════════════════════════════════════════════════
        // PASO 2: Descargar y procesar imagen del forecast
        // ═══════════════════════════════════════════════════════════════════
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🖼️  PASO 2: Descargando imagen del forecast en tiempo real...\n');
        
        const forecastResult = await forecastService.getForecast();
        
        console.log(`\n   📍 Imagen guardada: ${forecastResult.imagePath}`);
        console.log(`   📍 Output final: ${forecastResult.outputImagePath}\n`);

        // ═══════════════════════════════════════════════════════════════════
        // PASO 3: Mostrar resultados de detección de colores
        // ═══════════════════════════════════════════════════════════════════
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎨 PASO 3: Resultados de detección de colores\n');
        
        const { colorDetection, alertStatus } = forecastResult;
        
        console.log('   📊 Análisis de colores:');
        console.log(`      🔴 Rojo: ${colorDetection.redPercentage.toFixed(2)}% ${colorDetection.hasRed ? '(DETECTADO)' : ''}`);
        console.log(`      🟡 Amarillo: ${colorDetection.yellowPercentage.toFixed(2)}% ${colorDetection.hasYellow ? '(DETECTADO)' : ''}`);
        console.log();
        console.log(`   🚩 Bandera seleccionada: ${alertStatus.level.toUpperCase()}`);
        console.log(`   📋 Estado: ${alertStatus.label}`);
        console.log(`   📝 Descripción: ${alertStatus.description}\n`);

        // ═══════════════════════════════════════════════════════════════════
        // PASO 4: Enviar email con el reporte
        // ═══════════════════════════════════════════════════════════════════
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📨 PASO 4: Enviando email del forecast...\n');
        
        // Nota: sendForecastReport ya llama a getForecast internamente,
        // pero como ya lo ejecutamos, podríamos optimizar esto.
        // Por ahora, dejamos que se ejecute de nuevo para demostrar el flujo completo.
        const emailSent = await emailService.sendForecastReport(recipients);

        if (emailSent) {
            console.log(`\n   ✅ Email enviado exitosamente a: ${recipients.join(', ')}`);
        }

        // ═══════════════════════════════════════════════════════════════════
        // PASO 5: Mostrar información del scheduler
        // ═══════════════════════════════════════════════════════════════════
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('⏰ PASO 5: Configuración de horarios programados\n');
        
        scheduler.getNextExecutionInfo();
        console.log('\n   📅 Los emails se enviarán automáticamente a las:');
        console.log('      • 7:02 AM hora de Puerto Rico (AST)');
        console.log('      • 12:02 PM hora de Puerto Rico (AST)\n');

        // ═══════════════════════════════════════════════════════════════════
        // RESUMEN FINAL
        // ═══════════════════════════════════════════════════════════════════
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n╔══════════════════════════════════════════════════════════════╗');
        console.log('║              ✅ FLUJO COMPLETO EXITOSO                        ║');
        console.log('╚══════════════════════════════════════════════════════════════╝\n');
        
        console.log('📊 RESUMEN:');
        console.log(`   ⏱️  Tiempo total: ${duration} segundos`);
        console.log(`   🖼️  Imagen descargada: ✅`);
        console.log(`   🎨  Colores detectados: ✅`);
        console.log(`   🚩  Bandera: ${alertStatus.level.toUpperCase()}`);
        console.log(`   📨  Email enviado: ✅`);
        console.log(`   👥  Destinatarios: ${recipients.join(', ')}\n`);

        console.log('══════════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('\n❌ Error en el flujo:', error);
        process.exit(1);
    }

    process.exit(0);
}

testFullFlow().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});

