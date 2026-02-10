import 'dotenv/config';
import { Logger } from '../services/Logger.js';
import { SchedulerService } from '../services/SchedulerService.js';

async function testCron() {
    const logger = new Logger('debug');
    const scheduler = new SchedulerService(logger);

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║              🧪 TEST DE CRON JOB                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    // Mostrar hora actual
    const now = new Date();
    console.log(`📅 Hora actual (Local): ${now.toLocaleString()}`);
    console.log(`📅 Hora actual (Puerto Rico): ${now.toLocaleString('es-PR', { timeZone: 'America/Puerto_Rico' })}\n`);

    // Test 1: Verificar que las expresiones cron son válidas
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Test 1: Validación de expresiones cron\n');
    
    try {
        scheduler.scheduleForecastEmails(async () => {
            console.log('✅ Tarea ejecutada (simulación)');
        });
        console.log('✅ Expresiones cron válidas para 7:02 AM y 12:03 PM PST\n');
    } catch (error) {
        console.error('❌ Error en expresiones cron:', error);
        process.exit(1);
    }

    // Mostrar tareas activas
    const tasks = scheduler.listTasks();
    console.log(`📋 Tareas programadas: ${tasks.join(', ')}\n`);

    // Test 2: Programar una tarea de prueba que se ejecute en 3 segundos
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Test 2: Ejecución de tarea de prueba (3 segundos)\n');

    let testExecuted = false;

    scheduler.scheduleTest(async () => {
        testExecuted = true;
        console.log('\n🎉 ¡La tarea de prueba se ejecutó correctamente!');
        console.log(`   Hora de ejecución: ${new Date().toLocaleString()}`);
    }, 3);

    // Esperar a que se ejecute el test
    await new Promise(resolve => setTimeout(resolve, 4000));

    if (testExecuted) {
        console.log('\n✅ Test de cron job completado exitosamente');
    } else {
        console.log('\n❌ La tarea de prueba no se ejecutó');
    }

    // Mostrar información de próximas ejecuciones
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    scheduler.getNextExecutionInfo();

    // Limpiar
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    scheduler.stopAll();

    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('✅ TODOS LOS TESTS DE CRON COMPLETADOS');
    console.log('══════════════════════════════════════════════════════════════\n');

    process.exit(0);
}

testCron().catch(error => {
    console.error('Error en test:', error);
    process.exit(1);
});

