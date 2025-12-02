import cron, { ScheduledTask } from 'node-cron';
import { Logger } from './Logger.js';

export interface ScheduleConfig {
    name: string;
    cronExpression: string;
    timezone: string;
    task: () => Promise<void>;
}

export class SchedulerService {
    private tasks: Map<string, ScheduledTask> = new Map();

    constructor(private logger: Logger) {}

    /**
     * Programa una tarea con una expresión cron
     * @param config - Configuración del schedule
     */
    schedule(config: ScheduleConfig): void {
        const { name, cronExpression, timezone, task } = config;

        // Validar expresión cron
        if (!cron.validate(cronExpression)) {
            throw new Error(`Expresión cron inválida: ${cronExpression}`);
        }

        // Si ya existe una tarea con ese nombre, la detenemos
        if (this.tasks.has(name)) {
            this.stop(name);
        }

        this.logger.info(`📅 Programando tarea: ${name}`);
        this.logger.info(`   Cron: ${cronExpression}`);
        this.logger.info(`   Zona horaria: ${timezone}`);

        const scheduledTask = cron.schedule(
            cronExpression,
            async () => {
                const startTime = new Date();
                this.logger.info(`⏰ Ejecutando tarea programada: ${name}`);
                this.logger.info(`   Hora: ${startTime.toLocaleString('es-PR', { timeZone: timezone })}`);

                try {
                    await task();
                    const endTime = new Date();
                    const duration = endTime.getTime() - startTime.getTime();
                    this.logger.info(`✅ Tarea ${name} completada en ${duration}ms`);
                } catch (error) {
                    this.logger.error(`❌ Error en tarea ${name}:`, error);
                }
            },
            {
                timezone: timezone
            }
        );

        this.tasks.set(name, scheduledTask);
        this.logger.info(`✅ Tarea ${name} programada correctamente`);
    }

    /**
     * Programa el envío de forecast a las 7:02am y 12:03pm hora de Puerto Rico (AST)
     * @param sendForecast - Función que envía el forecast
     */
    scheduleForecastEmails(sendForecast: () => Promise<void>): void {
        const timezone = 'America/Puerto_Rico'; // AST = UTC-4 (sin horario de verano)

        // 7:02 AM Puerto Rico
        this.schedule({
            name: 'forecast-morning',
            cronExpression: '2 7 * * *',  // Minuto 2, Hora 7, todos los días
            timezone: timezone,
            task: sendForecast
        });

        // 12:02 PM Puerto Rico
        this.schedule({
            name: 'forecast-noon',
            cronExpression: '2 12 * * *', // Minuto 2, Hora 12, todos los días
            timezone: timezone,
            task: sendForecast
        });
    }

    /**
     * Programa un test que se ejecutará en X segundos (para pruebas)
     * @param task - Función a ejecutar
     * @param delaySeconds - Segundos hasta la ejecución
     */
    scheduleTest(task: () => Promise<void>, delaySeconds: number = 5): void {
        const now = new Date();
        const targetTime = new Date(now.getTime() + delaySeconds * 1000);
        
        const minute = targetTime.getMinutes();
        const second = targetTime.getSeconds();
        
        // node-cron no soporta segundos por defecto, usamos setTimeout para test
        this.logger.info(`🧪 Test programado para ejecutarse en ${delaySeconds} segundos...`);
        
        setTimeout(async () => {
            this.logger.info('⏰ Ejecutando tarea de prueba...');
            try {
                await task();
                this.logger.info('✅ Tarea de prueba completada');
            } catch (error) {
                this.logger.error('❌ Error en tarea de prueba:', error);
            }
        }, delaySeconds * 1000);
    }

    /**
     * Detiene una tarea programada
     * @param name - Nombre de la tarea
     */
    stop(name: string): void {
        const task = this.tasks.get(name);
        if (task) {
            task.stop();
            this.tasks.delete(name);
            this.logger.info(`🛑 Tarea ${name} detenida`);
        }
    }

    /**
     * Detiene todas las tareas programadas
     */
    stopAll(): void {
        this.logger.info('🛑 Deteniendo todas las tareas programadas...');
        for (const [name, task] of this.tasks) {
            task.stop();
            this.logger.info(`   Detenida: ${name}`);
        }
        this.tasks.clear();
        this.logger.info('✅ Todas las tareas detenidas');
    }

    /**
     * Lista todas las tareas activas
     */
    listTasks(): string[] {
        return Array.from(this.tasks.keys());
    }

    /**
     * Obtiene el próximo horario de ejecución formateado
     */
    getNextExecutionInfo(): void {
        const now = new Date();
        const puertoRicoTime = now.toLocaleString('es-PR', { timeZone: 'America/Puerto_Rico' });
        
        this.logger.info('📊 Información de horarios:');
        this.logger.info(`   Hora actual (Puerto Rico): ${puertoRicoTime}`);
        this.logger.info(`   Próximas ejecuciones:`);
        this.logger.info(`   - forecast-morning: 7:02 AM AST`);
        this.logger.info(`   - forecast-noon: 12:02 PM AST`);
    }
}

