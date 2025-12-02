import 'dotenv/config';
import { ConfigFactory } from './config/ConfigFactory.js';
import { Application } from './services/Application.js';

async function main() {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║          🌊 SWIM SAFE PUERTO RICO - PRODUCCIÓN               ║');
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

    // Iniciar la aplicación
    await app.bootstrap();

    // Mostrar configuración (ocultando datos sensibles)
    console.log('\n📋 Configuración:');
    console.table(config.toJSON());

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Aplicación en ejecución');
    console.log('📅 Emails programados para:');
    console.log('   • 7:02 AM hora Puerto Rico (AST)');
    console.log('   • 12:02 PM hora Puerto Rico (AST)');
    console.log('\n⏳ Esperando próximo envío programado...');
    console.log('   (Presiona Ctrl+C para detener)\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Mantener el proceso vivo
    // Los cron jobs se ejecutarán en segundo plano
}

main().catch((error) => {
    console.error('❌ Error al iniciar la aplicación:', error);
    process.exit(1);
});
