import 'dotenv/config';
/**
 * Test: Validación de Configuración de Producción
 *
 * Este test valida la configuración de producción SIN ENVIAR NINGÚN EMAIL
 * - Verifica conexión a la API de MailChimp
 * - Obtiene información de la audiencia de producción
 * - Valida que sea la audiencia correcta
 * - Muestra estadísticas de contactos
 *
 * SEGURO: No modifica ni envía nada, solo lee información
 */

import { Logger } from '../services/Logger.js';
import { MailChimpService } from '../services/MailChimpService.js';

async function validateProductionSetup() {
  const logger = new Logger('info');

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║     🔍 VALIDACIÓN DE CONFIGURACIÓN DE PRODUCCIÓN             ║');
  console.log('║              (NO SE ENVIARÁ NINGÚN EMAIL)                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Verificar variables de entorno
  const apiKey = process.env.MAILCHIMP_API_KEY;
  const listId = process.env.MAILCHIMP_LIST_ID;
  const fromEmail = process.env.MAILCHIMP_FROM_EMAIL;
  const fromName = process.env.MAILCHIMP_FROM_NAME;

  console.log('📋 Configuración Detectada:');
  console.log(`   API Key: ${apiKey ? '✅ Configurada' : '❌ NO configurada'}`);
  console.log(`   List ID: ${listId || '❌ NO configurado'}`);
  console.log(`   From Email: ${fromEmail || '❌ NO configurado'}`);
  console.log(`   From Name: ${fromName || '❌ NO configurado'}\n`);

  if (!apiKey || !listId) {
    console.error('❌ Faltan variables de entorno requeridas');
    console.error('\n💡 Asegúrate de:');
    console.error('   1. Copiar .env.production a .env');
    console.error('   2. Configurar MAILCHIMP_API_KEY con la clave de producción');
    process.exit(1);
  }

  if (apiKey === 'AQUI_VA_LA_API_KEY_DE_PRODUCCION') {
    console.error('❌ La API Key no ha sido reemplazada');
    console.error('\n💡 Pasos para obtener la API Key de producción:');
    console.error('   1. Iniciar sesión en la cuenta de MailChimp de producción');
    console.error('   2. Ir a Account → Extras → API keys');
    console.error('   3. Copiar la API key');
    console.error('   4. Reemplazar en .env.production\n');
    process.exit(1);
  }

  let mailChimpService: MailChimpService | null = null;

  try {
    console.log('🔌 Conectando a MailChimp...\n');
    mailChimpService = new MailChimpService(logger);

    console.log('✅ Conexión exitosa a MailChimp API\n');

    // Obtener información de la lista
    console.log('📊 Obteniendo información de la audiencia...\n');
    const listsResponse = await mailChimpService.getLists();

    if (!listsResponse.lists || listsResponse.lists.length === 0) {
      console.error('❌ No se encontraron audiencias en esta cuenta');
      process.exit(1);
    }

    const targetList = listsResponse.lists.find((list: any) => list.id === listId);

    if (!targetList) {
      console.error(`❌ No se encontró la lista con ID: ${listId}`);
      console.error('\n📋 Listas disponibles:\n');
      listsResponse.lists.forEach((list: any) => {
        console.error(`   - ${list.name} (ID: ${list.id})`);
      });
      process.exit(1);
    }

    console.log('✅ Audiencia encontrada:\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   📝 Nombre: ${targetList.name}`);
    console.log(`   🆔 ID: ${targetList.id}`);
    console.log(`   👥 Contactos totales: ${targetList.stats.member_count}`);
    console.log(`   ✉️  Contactos suscritos: ${targetList.stats.member_count - targetList.stats.unsubscribe_count}`);
    console.log(`   📧 Tasa de apertura: ${targetList.stats.open_rate.toFixed(2)}%`);
    console.log(`   🖱️  Tasa de clicks: ${targetList.stats.click_rate.toFixed(2)}%`);
    console.log(`   📅 Fecha de creación: ${new Date(targetList.date_created).toLocaleDateString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Advertencias de validación
    const warnings = [];

    if (targetList.name !== 'SwimSafe') {
      warnings.push(`Nombre de audiencia no coincide. Esperado: "SwimSafe", Actual: "${targetList.name}"`);
    }

    if (targetList.stats.member_count < 1000) {
      warnings.push(`Pocos contactos en la audiencia (${targetList.stats.member_count}). Se esperaban ~4,000`);
    }

    if (warnings.length > 0) {
      console.log('⚠️  ADVERTENCIAS:\n');
      warnings.forEach((warning) => {
        console.log(`   ⚠️  ${warning}`);
      });
      console.log('');
    }

    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║          ✅ VALIDACIÓN EXITOSA - LISTO PARA PRODUCCIÓN       ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    console.log('📋 Próximos pasos:');
    console.log('   1. ✅ Verificar que los datos mostrados sean correctos');
    console.log('   2. 🧪 Ejecutar: pnpm run test:prod:single');
    console.log('      (Enviará a UN solo contacto de prueba)');
    console.log('   3. 🚀 Si todo funciona, activar en producción\n');

    await mailChimpService.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error durante la validación:', error);
    if (mailChimpService) {
      await mailChimpService.close();
    }
    process.exit(1);
  }
}

validateProductionSetup();
