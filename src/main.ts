import 'dotenv/config';
import { ConfigFactory } from './config/ConfigFactory.js';
import { Application } from './services/Application.js';

async function main() {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║       🌊 SWIM SAFE PUERTO RICO - PRODUCCIÓN                  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const config = ConfigFactory.fromEnv();
    const app = new Application(config);

    // Manejar señales de cierre graceful
    const shutdown = async (signal: string) => {
        console.log(`\n📴 Recibida señal ${signal}, cerrando aplicación...`);
        await app.shutdown();
        console.log('👋 Aplicación cerrada correctamente');
        process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Iniciar la aplicación CON scheduler interno (cron jobs)
    await app.bootstrap();

    // Mostrar configuración (ocultando datos sensibles)
    console.log('\n📋 Configuración:');
    console.table(config.toJSON());

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Aplicación en ejecución con cron jobs internos');
    console.log('📅 Emails programados para (hora Puerto Rico - AST):');
    console.log('   • 7:02 AM');
    console.log('   • 12:02 PM');
    console.log('\n⏳ Esperando próximo envío programado...');
    console.log('   (La aplicación debe estar corriendo 24/7 con PM2)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // La aplicación se mantiene viva esperando los cron jobs
}

main().catch((error) => {
    console.error('❌ Error al iniciar la aplicación:', error);
    process.exit(1);
});
