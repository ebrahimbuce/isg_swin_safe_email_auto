import { IConfig } from '../config/Config.js';
import { BrowserService } from './BrowserService.js';
import { ImageProcessorService } from './ImageProcessorService.js';
import { ForecastService } from './ForecastService.js';
import { Logger } from './Logger.js';
import { EmailService } from './EmailService.js';
import { SchedulerService } from './SchedulerService.js';

export class Application {
    private logger: Logger;
    private browserService: BrowserService;
    private imageProcessor: ImageProcessorService;
    private forecastService: ForecastService;
    private emailService: EmailService;
    private scheduler: SchedulerService;

    constructor(private config: IConfig) {
        this.logger = new Logger(config.logLevel);
        this.browserService = new BrowserService(this.logger);
        this.imageProcessor = new ImageProcessorService(this.logger);
        this.forecastService = new ForecastService(this.logger, this.imageProcessor);
        this.emailService = new EmailService(this.logger, this.forecastService);
        this.scheduler = new SchedulerService(this.logger);
    }

    async bootstrap(): Promise<void> {
        this.logger.info('Iniciando aplicación...');
        this.logger.info(`Entorno: ${this.config.nodeEnv}`);
        this.logger.info(`Puerto: ${this.config.port}`);

        try {
            // Programar los envíos automáticos de email
            if (this.config.emailRecipients.length > 0) {
                this.startScheduledEmails();
            } else {
                this.logger.warn('No hay destinatarios configurados - Los emails programados no se enviarán');
            }

            this.logger.info('Aplicación iniciada correctamente');
            this.scheduler.getNextExecutionInfo();
        } catch (error) {
            this.logger.error('Error durante el bootstrap:', error);
            throw error;
        }
    }

    /**
     * Inicia los envíos programados de email a las 7:02 AM y 12:03 PM PST
     */
    startScheduledEmails(): void {
        this.logger.info('📅 Configurando envíos programados de email...');
        
        this.scheduler.scheduleForecastEmails(async () => {
            try {
                this.logger.info('🚀 Iniciando envío programado de forecast...');
                await this.emailService.sendForecastReport(this.config.emailRecipients);
                this.logger.info('✅ Envío programado completado');
            } catch (error) {
                this.logger.error('❌ Error en envío programado:', error);
            }
        });
    }

    async shutdown(): Promise<void> {
        this.logger.info('Cerrando aplicación...');
        this.scheduler.stopAll();
        this.emailService.close();
        await this.browserService.close();
        this.logger.info('Aplicación cerrada');
    }

    /**
     * Ejecuta el envío de forecast inmediatamente (para pruebas manuales)
     */
    async runOnce(): Promise<void> {
        try {
            this.logger.info('Ejecutando envío manual de forecast...');
            await this.emailService.sendForecastReport(this.config.emailRecipients);
            this.logger.info('Envío manual completado');
        } catch (error) {
            this.logger.error('Error en la ejecución:', error);
            throw error;
        }
    }

    /**
     * Obtiene el servicio de forecast
     */
    getForecastService(): ForecastService {
        return this.forecastService;
    }

    /**
     * Obtiene el servicio de scheduler
     */
    getScheduler(): SchedulerService {
        return this.scheduler;
    }

    /**
     * Envía el reporte del forecast a los destinatarios especificados
     * @param to - Destinatarios del email
     * @returns true si se envió correctamente
     */
    async sendForecastReport(to: string | string[]): Promise<boolean> {
        return await this.emailService.sendForecastReport(to);
    }
}
