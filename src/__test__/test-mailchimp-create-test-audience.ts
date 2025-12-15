import 'dotenv/config';
/**
 * Test: Crear Audiencia de Prueba en MailChimp Personal
 *
 * Este script:
 * 1. Crea una audiencia de prueba llamada "SwimSafe TEST"
 * 2. Agrega algunos contactos de prueba
 * 3. Obtiene el forecast actual
 * 4. Envía una campaña de prueba
 *
 * IMPORTANTE: Este es para tu MailChimp personal, NO afecta producción
 */

import { Logger } from '../services/Logger.js';
import { ForecastService } from '../services/ForecastService.js';
import { ImageProcessorService } from '../services/ImageProcessorService.js';
import { BrowserService } from '../services/BrowserService.js';
import { MailChimpService } from '../services/MailChimpService.js';
import { HTMLEmailGeneratorService } from '../services/HTMLEmailGeneratorService.js';
import { MailChimpAutomationService } from '../services/MailChimpAutomationService.js';

async function main() {
  const logger = new Logger('MailChimpTestSetup');
  let browserService: BrowserService | null = null;
  let mailChimpService: MailChimpService | null = null;

  try {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 SETUP: CREAR AUDIENCIA DE PRUEBA EN MAILCHIMP PERSONAL');
    console.log('='.repeat(80) + '\n');

    // ========================================================================
    // PASO 1: Inicializar servicios
    // ========================================================================
    logger.info('📦 Inicializando servicios...');

    mailChimpService = new MailChimpService(logger);

    logger.info('✓ MailChimp Service inicializado');

    // ========================================================================
    // PASO 2: Verificar listas existentes y seleccionar una
    // ========================================================================
    logger.info('\n🔍 Buscando audiencias en tu cuenta de MailChimp...');

    const listsResponse = await mailChimpService.getLists();

    if (!listsResponse.lists || listsResponse.lists.length === 0) {
      console.log('\n❌ No tienes ninguna audiencia en tu cuenta de MailChimp.');
      console.log('   Por favor, crea una audiencia manualmente en MailChimp primero.');
      console.log('   Puedes hacerlo en: https://admin.mailchimp.com/lists/');
      process.exit(1);
    }

    console.log(`\n✅ Encontradas ${listsResponse.lists.length} audiencia(s):\n`);

    listsResponse.lists.forEach((list: any, index: number) => {
      console.log(`${index + 1}. ${list.name}`);
      console.log(`   ID: ${list.id}`);
      console.log(`   Miembros: ${list.stats.member_count}`);
      console.log(`   Fecha creación: ${new Date(list.date_created).toLocaleDateString()}`);
      console.log('');
    });

    // Usar la primera lista disponible
    const testList = listsResponse.lists[0];
    const testListId = testList.id;

    logger.info(`📋 Usando audiencia: "${testList.name}" (${testListId})`);
    console.log(`   Miembros actuales: ${testList.stats.member_count}`);

    // ========================================================================
    // PASO 3: Agregar contactos de prueba (opcional)
    // ========================================================================
    logger.info('\n👥 Agregando contactos de prueba...');

    const testContacts = [
      {
        email: process.env.MAILCHIMP_FROM_EMAIL || 'test1@example.com',
        firstName: 'Ebrahim',
        lastName: 'Buceta',
      },
      {
        email: 'test2@example.com',
        firstName: 'Test',
        lastName: 'User 2',
      },
      {
        email: 'test3@example.com',
        firstName: 'Test',
        lastName: 'User 3',
      },
    ];

    for (const contact of testContacts) {
      try {
        await mailChimpService.addMember(contact, testListId);
        logger.info(`   ✓ Agregado: ${contact.email}`);
      } catch (error: any) {
        if (error.message && error.message.includes('already exists')) {
          logger.info(`   ⊘ Ya existe: ${contact.email}`);
        } else {
          logger.warn(`   ✗ Error al agregar ${contact.email}: ${error.message}`);
        }
      }
    }

    // ========================================================================
    // PASO 4: Mostrar información para actualizar .env
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('✅ SETUP COMPLETADO');
    console.log('='.repeat(80));
    console.log('\n📋 Actualiza tu archivo .env con:');
    console.log('\n' + '-'.repeat(80));
    console.log(`MAILCHIMP_LIST_ID=${testListId}`);
    console.log('-'.repeat(80));

    console.log('\n🎯 Próximo paso:');
    console.log('   1. Copia el MAILCHIMP_LIST_ID de arriba');
    console.log('   2. Pégalo en el archivo .env');
    console.log('   3. Ejecuta: pnpm run test:mailchimp:automation');
    console.log('\n');

    // ========================================================================
    // PASO 5: Opcionalmente, enviar una campaña de prueba
    // ========================================================================
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question('\n¿Quieres enviar una campaña de prueba ahora? (s/n): ', resolve);
    });

    rl.close();

    if (answer.toLowerCase() === 's' || answer.toLowerCase() === 'si') {
      logger.info('\n🚀 Enviando campaña de prueba...');

      browserService = new BrowserService(logger);
      const imageProcessor = new ImageProcessorService(logger);
      const forecastService = new ForecastService(logger, imageProcessor);
      const htmlEmailGenerator = new HTMLEmailGeneratorService(logger);

      // Crear una instancia temporal con el testListId
      const testMailChimpService = new MailChimpService(logger, { listId: testListId });
      const mailChimpAutomation = new MailChimpAutomationService(testMailChimpService, htmlEmailGenerator);

      // Obtener forecast y enviar
      const forecastResult = await forecastService.getForecast();
      const result = await mailChimpAutomation.sendForecastCampaignAutomated(forecastResult);

      mailChimpAutomation.showOperationLog(result);

      if (result.success) {
        console.log('✅ Campaña de prueba enviada exitosamente!\n');
      } else {
        console.log('❌ Error al enviar campaña de prueba\n');
      }

      await testMailChimpService.close();
    } else {
      console.log('\n✓ Setup completado. Puedes enviar una campaña cuando estés listo.\n');
    }

    process.exit(0);
  } catch (error) {
    logger.error('\n❌ Error en el setup:', error);
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

// Ejecutar el setup
main();
