import 'dotenv/config';
import { Logger } from '../services/Logger.js';
import { ImageProcessorService } from '../services/ImageProcessorService.js';
import { ForecastService } from '../services/ForecastService.js';
import { MailChimpService } from '../services/MailChimpService.js';

async function testMailChimp() {
    const logger = new Logger('debug');
    
    console.log('\n=== TEST DE INTEGRACIÓN CON MAILCHIMP ===\n');
    
    // Verificar variables de entorno
    console.log('📧 Verificando configuración:');
    console.log(`   MAILCHIMP_API_KEY: ${process.env.MAILCHIMP_API_KEY ? '✅ Configurado' : '❌ NO CONFIGURADO'}`);
    console.log(`   MAILCHIMP_SERVER_PREFIX: ${process.env.MAILCHIMP_SERVER_PREFIX || 'us1 (default)'}`);
    console.log(`   MAILCHIMP_LIST_ID: ${process.env.MAILCHIMP_LIST_ID || '❌ NO CONFIGURADO'}`);
    console.log(`   MAILCHIMP_FROM_EMAIL: ${process.env.MAILCHIMP_FROM_EMAIL || '❌ NO CONFIGURADO'}`);
    console.log(`   MAILCHIMP_FROM_NAME: ${process.env.MAILCHIMP_FROM_NAME || 'Swim Safe Puerto Rico (default)'}\n`);
    
    if (!process.env.MAILCHIMP_API_KEY) {
        console.error('\n❌ Error: Configura MAILCHIMP_API_KEY en el archivo .env');
        console.error('   Puedes obtener tu API Key en: https://us1.admin.mailchimp.com/account/api/');
        process.exit(1);
    }

    if (!process.env.MAILCHIMP_LIST_ID) {
        console.error('\n❌ Error: Configura MAILCHIMP_LIST_ID en el archivo .env');
        console.error('   Puedes encontrar el List ID en: Settings > List name and defaults');
        process.exit(1);
    }

    try {
        // Crear servicios
        const imageProcessor = new ImageProcessorService(logger);
        const forecastService = new ForecastService(logger, imageProcessor);
        const mailChimpService = new MailChimpService(logger, forecastService);

        console.log('\n🚀 Inicializando MailChimp...\n');
        
        // Inicializar MailChimp
        await mailChimpService.initialize();

        // Obtener información de la lista
        console.log('\n📋 Obteniendo información de la lista...\n');
        const listInfo = await mailChimpService.getListInfo();
        console.log(`   Nombre de la lista: ${listInfo.name}`);
        console.log(`   Miembros: ${listInfo.stats.member_count}`);
        console.log(`   Estado: ${listInfo.status}\n`);

        // Opción 1: Enviar reporte completo del forecast
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📨 OPCIÓN 1: Enviar reporte completo del forecast\n');
        
        const sendFullReport = process.argv.includes('--full-report');
        
        if (sendFullReport) {
            console.log('🖼️  Obteniendo forecast...\n');
            const forecastResult = await forecastService.getForecast();
            
            console.log(`   📍 Imagen guardada: ${forecastResult.imagePath}`);
            console.log(`   📍 Output final: ${forecastResult.outputImagePath}`);
            console.log(`   🚩 Bandera: ${forecastResult.alertStatus.level.toUpperCase()}\n`);
            
            console.log('📧 Enviando campaña a MailChimp...\n');
            const result = await mailChimpService.sendForecastReport(forecastResult);
            
            if (result) {
                console.log('\n✅ ¡Campaña enviada exitosamente a MailChimp!');
                console.log('   Revisa tu cuenta de MailChimp para ver la campaña.\n');
            }
        } else {
            console.log('   (Omitido - usa --full-report para enviar el reporte completo)');
        }

        // Opción 2: Agregar un miembro de prueba
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('👤 OPCIÓN 2: Agregar miembro de prueba\n');
        
        const testEmail = process.argv.find(arg => arg.includes('@'));
        if (testEmail) {
            console.log(`📬 Agregando miembro: ${testEmail}\n`);
            await mailChimpService.addMember({
                email: testEmail,
                firstName: 'Test',
                lastName: 'User',
                status: 'subscribed'
            });
            console.log('✅ Miembro agregado exitosamente\n');
        } else {
            console.log('   (Omitido - pasa un email como argumento para agregar un miembro)');
            console.log('   Ejemplo: npm run test:mailchimp test@example.com\n');
        }

        // Opción 3: Listar miembros
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 OPCIÓN 3: Listar miembros de la lista\n');
        
        const listMembers = await mailChimpService.getListMembers(undefined, 5);
        console.log(`   Total de miembros mostrados: ${listMembers.members.length}`);
        listMembers.members.forEach((member: any, index: number) => {
            console.log(`   ${index + 1}. ${member.email_address} (${member.status})`);
        });
        console.log();

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n✅ Test de MailChimp completado exitosamente\n');
        console.log('💡 TIPS:');
        console.log('   • Para enviar el reporte completo: npm run test:mailchimp -- --full-report');
        console.log('   • Para agregar un miembro: npm run test:mailchimp test@example.com');
        console.log('   • Para ambas: npm run test:mailchimp test@example.com -- --full-report\n');

    } catch (error) {
        console.error('\n❌ Error en el test:', error);
        if (error instanceof Error) {
            console.error(`   Mensaje: ${error.message}`);
        }
        process.exit(1);
    }

    process.exit(0);
}

testMailChimp().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});



