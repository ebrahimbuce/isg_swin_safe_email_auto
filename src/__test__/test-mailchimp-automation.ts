import 'dotenv/config';
/**
 * Test de MailChimp Automation Service (Producción)
 *
 * Este test valida el flujo completo de automatización de MailChimp:
 * 1. Obtiene el forecast actual
 * 2. Genera el contenido del email
 * 3. Envía la campaña a la audiencia de producción (87ebf0ff4d)
 * 4. Muestra el log de auditoría completo
 *
 * IMPORTANTE: Usa la audiencia de producción existente
 */

import { Logger } from '../services/Logger.js';
import { ForecastService } from '../services/ForecastService.js';
import { ImageProcessorService } from '../services/ImageProcessorService.js';
import { BrowserService } from '../services/BrowserService.js';
import { MailChimpService } from '../services/MailChimpService.js';
import { HTMLEmailGeneratorService } from '../services/HTMLEmailGeneratorService.js';
import { MailChimpAutomationService } from '../services/MailChimpAutomationService.js';

async function main() {
  const logger = new Logger('MailChimpAutomationTest');
  let browserService: BrowserService | null = null;
  let mailChimpService: MailChimpService | null = null;

  try {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 TEST: MAILCHIMP AUTOMATION SERVICE (PRODUCTION)');
    console.log('='.repeat(80) + '\n');

    // ========================================================================
    // PASO 1: Inicializar servicios
    // ========================================================================
    logger.info('📦 Inicializando servicios...');

    browserService = new BrowserService(logger);
    const imageProcessor = new ImageProcessorService(logger);
    const forecastService = new ForecastService(logger, imageProcessor);
    mailChimpService = new MailChimpService(logger);
    const htmlEmailGenerator = new HTMLEmailGeneratorService(logger);
    const mailChimpAutomation = new MailChimpAutomationService(mailChimpService, htmlEmailGenerator);

    logger.info('✓ Servicios inicializados');

    // Mostrar configuración actual
    const config = mailChimpAutomation.getConfig();
    console.log('\n📋 Configuración de MailChimp:');
    console.log(`   Server Prefix: ${config.serverPrefix}`);
    console.log(`   List ID (Audience): ${config.listId}`);
    console.log(`   From Email: ${config.fromEmail}`);
    console.log(`   From Name: ${config.fromName}`);

    // ========================================================================
    // PASO 2: Obtener forecast actual
    // ========================================================================
    logger.info('\n🌊 Obteniendo forecast actual...');
    const forecastResult = await forecastService.getForecast();

    logger.info('✓ Forecast obtenido exitosamente');
    logger.info(`   Nivel de alerta: ${forecastResult.alertStatus.level}`);
    logger.info(`   Imagen: ${forecastResult.outputImagePath}`);

    // ========================================================================
    // PASO 3: Enviar campaña automatizada
    // ========================================================================
    logger.info('\n📤 Enviando campaña automatizada a MailChimp...');
    const result = await mailChimpAutomation.sendForecastCampaignAutomated(forecastResult);

    // ========================================================================
    // PASO 4: Mostrar resultados
    // ========================================================================
    mailChimpAutomation.showOperationLog(result);

    if (result.success) {
      console.log('✅ PRUEBA EXITOSA: La campaña fue enviada correctamente\n');
      process.exit(0);
    } else {
      console.log('❌ PRUEBA FALLIDA: La campaña no pudo ser enviada\n');
      if (result.error) {
        console.error('Error:', result.error.message);
      }
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
    if (mailChimpService) {
      await mailChimpService.close();
    }
  }
}

// Ejecutar el test
main();
