import 'dotenv/config';
/**
 * Test: Envío Paralelo de Email y MailChimp
 *
 * Este test simula el comportamiento del cron job:
 * 1. Obtiene el forecast UNA SOLA VEZ
 * 2. Envía email normal Y campaña MailChimp EN PARALELO
 * 3. Mide el tiempo total para verificar la optimización
 *
 * Esto demuestra que ambos sistemas funcionan simultáneamente
 * sin duplicar la descarga de imágenes ni el procesamiento.
 */

import { Logger } from '../services/Logger.js';
import { ForecastService } from '../services/ForecastService.js';
import { ImageProcessorService } from '../services/ImageProcessorService.js';
import { BrowserService } from '../services/BrowserService.js';
import { EmailService } from '../services/EmailService.js';
import { MailChimpService } from '../services/MailChimpService.js';
import { HTMLEmailGeneratorService } from '../services/HTMLEmailGeneratorService.js';
import { MailChimpAutomationService } from '../services/MailChimpAutomationService.js';

async function main() {
  const logger = new Logger('ParallelSendTest');
  let browserService: BrowserService | null = null;
  let emailService: EmailService | null = null;
  let mailChimpService: MailChimpService | null = null;

  try {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 TEST: ENVÍO PARALELO EMAIL + MAILCHIMP');
    console.log('='.repeat(80) + '\n');

    const startTime = Date.now();

    // ========================================================================
    // PASO 1: Inicializar servicios
    // ========================================================================
    logger.info('📦 Inicializando servicios...');

    browserService = new BrowserService(logger);
    const imageProcessor = new ImageProcessorService(logger);
    const forecastService = new ForecastService(logger, imageProcessor);
    const htmlEmailGenerator = new HTMLEmailGeneratorService(logger);

    emailService = new EmailService(logger, forecastService, htmlEmailGenerator, imageProcessor);

    mailChimpService = new MailChimpService(logger);
    const mailChimpAutomation = new MailChimpAutomationService(mailChimpService, htmlEmailGenerator);

    logger.info('✓ Servicios inicializados');

    // ========================================================================
    // PASO 2: Obtener forecast UNA SOLA VEZ (optimización clave)
    // ========================================================================
    logger.info('\n🌊 Obteniendo forecast...');
    const forecastStart = Date.now();
    const forecastResult = await forecastService.getForecast();
    const forecastTime = Date.now() - forecastStart;

    logger.info(`✓ Forecast obtenido en ${forecastTime}ms`);
    logger.info(`   Nivel de alerta: ${forecastResult.alertStatus.level}`);
    logger.info(`   Imagen: ${forecastResult.outputImagePath}`);

    // ========================================================================
    // PASO 3: Enviar AMBOS en paralelo usando el mismo forecast
    // ========================================================================
    logger.info('\n📤 Enviando email y MailChimp EN PARALELO...');
    const sendStart = Date.now();

    const emailRecipients = process.env.PREVIEW_EMAILS || process.env.EMAIL_RECIPIENTS || '';

    // Ejecutar ambos simultáneamente
    const [emailResult, mailchimpResult] = await Promise.allSettled([
      emailService.sendForecastReport({
        to: emailRecipients,
        forecastResult, // Reutilizar el forecast
      }),
      mailChimpAutomation.sendForecastCampaignAutomated(forecastResult),
    ]);

    const sendTime = Date.now() - sendStart;

    // ========================================================================
    // PASO 4: Reportar resultados
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESULTADOS DEL ENVÍO PARALELO');
    console.log('='.repeat(80));

    console.log('\n📧 Email Normal:');
    if (emailResult.status === 'fulfilled') {
      console.log(`   ✅ Enviado correctamente (${emailResult.value})`);
    } else {
      console.log(`   ❌ Error: ${emailResult.reason}`);
    }

    console.log('\n📬 MailChimp:');
    if (mailchimpResult.status === 'fulfilled') {
      const result = mailchimpResult.value;
      if (result.success) {
        console.log(`   ✅ Campaña enviada correctamente`);
        console.log(`   Lista ID: ${result.listId}`);
        console.log(`   Operaciones: ${result.operations.length}`);
      } else {
        console.log(`   ❌ Error: ${result.error?.message}`);
      }
    } else {
      console.log(`   ❌ Error: ${mailchimpResult.reason}`);
    }

    // ========================================================================
    // PASO 5: Métricas de rendimiento
    // ========================================================================
    const totalTime = Date.now() - startTime;

    console.log('\n' + '='.repeat(80));
    console.log('⚡ MÉTRICAS DE RENDIMIENTO');
    console.log('='.repeat(80));
    console.log(`   Obtención de forecast: ${forecastTime}ms`);
    console.log(`   Envío paralelo: ${sendTime}ms`);
    console.log(`   Tiempo total: ${totalTime}ms`);
    console.log('='.repeat(80));

    console.log('\n✨ VENTAJAS DE ESTE ENFOQUE:');
    console.log('   1. ✅ El forecast se descarga UNA SOLA VEZ');
    console.log('   2. ✅ Ambos envíos ocurren SIMULTÁNEAMENTE');
    console.log('   3. ✅ Si uno falla, el otro continúa');
    console.log('   4. ✅ Máxima eficiencia y mínima latencia');
    console.log('   5. ✅ Mismo comportamiento que el cron job\n');

    const bothSuccess =
      emailResult.status === 'fulfilled' && mailchimpResult.status === 'fulfilled' && mailchimpResult.value.success;

    if (bothSuccess) {
      console.log('✅ PRUEBA EXITOSA: Ambos envíos completados\n');
      process.exit(0);
    } else {
      console.log('⚠️  PRUEBA PARCIAL: Al menos un envío falló\n');
      process.exit(1);
    }
  } catch (error) {
    logger.error('\n❌ Error en el test:', error);
    console.error(error);
    process.exit(1);
  } finally {
    // Limpieza de recursos
    if (browserService) {
      await browserService.close();
    }
    if (emailService) {
      await emailService.close();
    }
    if (mailChimpService) {
      await mailChimpService.close();
    }
  }
}

// Ejecutar el test
main();
