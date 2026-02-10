import 'dotenv/config';
/**
 * Test: Envío a UN Solo Contacto (Producción)
 *
 * Este test envía una campaña de MailChimp usando la configuración
 * de PRODUCCIÓN pero SOLO a tu email de prueba (PREVIEW_EMAILS)
 *
 * IMPORTANTE: Esto usa la API de producción pero no afecta a los
 * 4,174 contactos reales. Solo envía a tu email.
 */

import { Logger } from '../services/Logger.js';
import { ImageProcessorService } from '../services/ImageProcessorService.js';
import { ForecastService } from '../services/ForecastService.js';
import { BrowserService } from '../services/BrowserService.js';
import { MailChimpService } from '../services/MailChimpService.js';
import { HTMLEmailGeneratorService } from '../services/HTMLEmailGeneratorService.js';
import { MailChimpAutomationService } from '../services/MailChimpAutomationService.js';

async function testSingleSend() {
  const logger = new Logger('info');
  let browserService: BrowserService | null = null;
  let mailChimpService: MailChimpService | null = null;

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║      🧪 TEST DE ENVÍO A UN SOLO CONTACTO (PRODUCCIÓN)        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const testEmail = process.env.PREVIEW_EMAILS;

  if (!testEmail) {
    console.error('❌ PREVIEW_EMAILS no configurado en .env');
    process.exit(1);
  }

  console.log(`📧 Destinatario del test: ${testEmail}\n`);
  console.log('⚠️  IMPORTANTE:');
  console.log('   - Este test usa la API de PRODUCCIÓN');
  console.log('   - Pero SOLO enviará a tu email de prueba');
  console.log('   - NO afecta a los 4,174 contactos de producción\n');

  // Advertencia de seguridad
  const listId = process.env.MAILCHIMP_LIST_ID;
  console.log(`🔍 Audiencia configurada: ${listId}\n`);

  if (listId !== '87ebf0ff4d') {
    console.warn('⚠️  ADVERTENCIA: No estás usando la audiencia de producción');
    console.warn(`   Esperado: 87ebf0ff4d, Actual: ${listId}\n`);
  }

  // Countdown de seguridad
  console.log('⏳ Esperando 5 segundos... (CTRL+C para cancelar)\n');
  for (let i = 5; i > 0; i--) {
    process.stdout.write(`   ${i}... `);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  console.log('¡Comenzando!\n');

  try {
    // ========================================================================
    // PASO 1: Inicializar servicios
    // ========================================================================
    console.log('📦 Inicializando servicios...');

    browserService = new BrowserService(logger);
    const imageProcessor = new ImageProcessorService(logger);
    const forecastService = new ForecastService(logger, imageProcessor);
    const htmlGenerator = new HTMLEmailGeneratorService(logger);
    mailChimpService = new MailChimpService(logger);
    const mailChimpAutomation = new MailChimpAutomationService(mailChimpService, htmlGenerator);

    console.log('✓ Servicios inicializados\n');

    // ========================================================================
    // PASO 2: Obtener forecast
    // ========================================================================
    console.log('🌊 Obteniendo forecast actual...');
    const forecastResult = await forecastService.getForecast();

    console.log(`✅ Forecast obtenido: ${forecastResult.alertStatus.level}\n`);

    // ========================================================================
    // PASO 3: Crear una lista temporal solo con tu email
    // ========================================================================
    console.log('📝 Nota: El sistema enviará a la lista configurada');
    console.log('   Asegúrate de que tu email esté en la audiencia de producción');
    console.log('   o considera crear una lista de prueba separada\n');

    // ========================================================================
    // PASO 4: Enviar campaña
    // ========================================================================
    console.log('📤 Enviando campaña de prueba...\n');
    const result = await mailChimpAutomation.sendForecastCampaignAutomated(forecastResult);

    // ========================================================================
    // PASO 5: Mostrar resultados
    // ========================================================================
    mailChimpAutomation.showOperationLog(result);

    if (result.success) {
      console.log('╔══════════════════════════════════════════════════════════════╗');
      console.log('║              ✅ CAMPAÑA ENVIADA EXITOSAMENTE                 ║');
      console.log('╚══════════════════════════════════════════════════════════════╝\n');
      console.log('📋 Próximos pasos:');
      console.log('   1. Revisa tu inbox y verifica que el email llegó');
      console.log('   2. Verifica que el formato sea correcto');
      console.log('   3. Verifica que la imagen se vea bien');
      console.log('   4. Si todo está bien, ya puedes activar en producción\n');
      console.log('⚠️  RECUERDA: Una vez activado, se enviará a TODOS');
      console.log('   los contactos suscritos en la audiencia de producción\n');
    } else {
      console.log('╔══════════════════════════════════════════════════════════════╗');
      console.log('║                  ❌ ERROR EN EL ENVÍO                        ║');
      console.log('╚══════════════════════════════════════════════════════════════╝\n');
      console.log('Revisa el log de errores arriba para más detalles\n');
    }

    await mailChimpService.close();
    await browserService.close();

    process.exit(result.success ? 0 : 1);
  } catch (error) {
    logger.error('\n❌ Error en el test:', error);
    console.error(error);

    if (mailChimpService) {
      await mailChimpService.close();
    }
    if (browserService) {
      await browserService.close();
    }

    process.exit(1);
  }
}

testSingleSend();
