import { IConfig } from '../config/Config.js';
import { BrowserService } from './BrowserService.js';
import { ImageProcessorService } from './ImageProcessorService.js';
import { ForecastService } from './ForecastService.js';
import { Logger } from './Logger.js';
import { Server } from './Server.js';
import { EmailService } from './EmailService.js';
import { HTMLEmailGeneratorService } from './HTMLEmailGeneratorService.js';
import { SchedulerService } from './SchedulerService.js';
import { MailChimpService } from './MailChimpService.js';
import { MailChimpAutomationService } from './MailChimpAutomationService.js';
import type { ForecastResult } from './dto/ForecastDTO.js';

export class Application {
  private logger: Logger;
  private server: Server;
  private browserService: BrowserService;
  private imageProcessor: ImageProcessorService;
  private forecastService: ForecastService;
  private htmlEmailGenerator: HTMLEmailGeneratorService;
  private emailService: EmailService;
  private mailChimpService: MailChimpService | null = null;
  private mailChimpAutomation: MailChimpAutomationService | null = null;
  private scheduler: SchedulerService;

  constructor(private config: IConfig) {
    this.logger = new Logger(config.logLevel);
    this.browserService = new BrowserService(this.logger);
    this.imageProcessor = new ImageProcessorService(this.logger);
    this.forecastService = new ForecastService(this.logger, this.imageProcessor);
    this.server = new Server(config, this.logger, this.forecastService);
    this.htmlEmailGenerator = new HTMLEmailGeneratorService(this.logger);
    this.emailService = new EmailService(
      this.logger,
      this.forecastService,
      this.htmlEmailGenerator,
      this.imageProcessor
    );

    // Inicializar MailChimp solo si está configurado
    // DESACTIVADO: this.initializeMailChimp();

    this.scheduler = new SchedulerService(this.logger);
  }

  /**
   * Inicializa los servicios de MailChimp si están configurados
   */
  private initializeMailChimp(): void {
    const mailchimpApiKey = process.env.MAILCHIMP_API_KEY;
    const mailchimpListId = process.env.MAILCHIMP_LIST_ID;

    if (mailchimpApiKey && mailchimpListId) {
      this.logger.info('📧 Inicializando MailChimp automation...');
      this.mailChimpService = new MailChimpService(this.logger);
      this.mailChimpAutomation = new MailChimpAutomationService(this.mailChimpService, this.htmlEmailGenerator);
      this.logger.info('✓ MailChimp automation habilitado');
    } else {
      this.logger.info('ℹ️  MailChimp no configurado - Solo se enviarán emails normales');
    }
  }

  /**
   * Inicia la aplicación CON scheduler interno (cron jobs)
   */
  async bootstrap(): Promise<void> {
    this.logger.info('Iniciando aplicación con scheduler...');
    this.logger.info(`Entorno: ${this.config.nodeEnv}`);
    this.logger.info(`Puerto: ${this.config.port}`);

    try {
      // Iniciar servidor HTTP
      this.server.start();

      // Programar los envíos automáticos de email (solo preview)
      if (this.PREVIEW_EMAILS.length > 0) {
        this.startScheduledEmails();
      } else {
        this.logger.warn('⚠️  PREVIEW_EMAILS no está configurado - Los emails programados no se enviarán');
      }

      this.logger.info('Aplicación iniciada correctamente');
      this.scheduler.getNextExecutionInfo();
    } catch (error) {
      this.logger.error('Error durante el bootstrap:', error);
      throw error;
    }
  }

  /**
   * Inicia la aplicación SIN scheduler interno (para usar con cron-job.org)
   */
  async bootstrapWithoutScheduler(): Promise<void> {
    this.logger.info('Iniciando aplicación (modo HTTP)...');
    this.logger.info(`Entorno: ${this.config.nodeEnv}`);
    this.logger.info(`Puerto: ${this.config.port}`);
    this.logger.info(`Destinatarios: ${this.config.emailRecipients.join(', ')}`);

    // Iniciar servidor HTTP
    this.server.start();
  }

  // Emails para recibir preview 15 minutos antes (puede ser múltiples separados por coma)
  private readonly PREVIEW_EMAILS: string[] = (process.env.PREVIEW_EMAILS || '')
    .split(',')
    .map((email) => email.trim())
    .filter((email) => email.length > 0);

  /**
   * Inicia los envíos programados de email
   * DESACTIVADO: Envío principal a todos los recipients
   * ACTIVO: Solo preview a PREVIEW_EMAILS
   */
  startScheduledEmails(): void {
    this.logger.info('📅 Configurando envíos programados de email...');
    this.logger.info('ℹ️  Modo PREVIEW ONLY - Solo se enviarán previews');

    // DESACTIVADO: Función para envío principal (todos los destinatarios)
    // const sendMainForecast = async () => {
    //   try {
    //     this.logger.info('🚀 Iniciando envío programado de forecast...');
    //     const forecastResult = await this.forecastService.getForecast();
    //     await this.emailService.sendForecastReport({
    //       to: this.config.emailRecipients,
    //       forecastResult,
    //     });
    //     this.logger.info('✅ Email normal enviado correctamente');
    //     this.logger.info('✅ Envío programado completado');
    //   } catch (error) {
    //     this.logger.error('❌ Error en envío programado:', error);
    //   }
    // };

    // Función para envío preview (solo a los emails configurados en PREVIEW_EMAILS)
    const sendPreviewForecast = async () => {
      try {
        if (this.PREVIEW_EMAILS.length === 0) {
          this.logger.warn('⚠️  PREVIEW_EMAILS no está configurado - No se enviará preview');
          return;
        }
        this.logger.info(`📬 Iniciando envío PREVIEW a ${this.PREVIEW_EMAILS.join(', ')}...`);
        await this.emailService.sendForecastReport({ to: this.PREVIEW_EMAILS });
        this.logger.info('✅ Envío preview completado');
      } catch (error) {
        this.logger.error('❌ Error en envío preview:', error);
      }
    };

    // DESACTIVADO: Envío principal - solo pasar preview
    // this.scheduler.scheduleForecastEmails(sendMainForecast, sendPreviewForecast);

    // Solo programar previews
    this.schedulePreviewOnly(sendPreviewForecast);
  }

  /**
   * Programa solo los envíos de preview (sin envío principal)
   */
  private schedulePreviewOnly(sendPreviewForecast: () => Promise<void>): void {
    const timezone = 'America/Puerto_Rico';

    // 6:47 AM Puerto Rico (15 min antes de 7:02 AM)
    this.scheduler.schedule({
      name: 'forecast-morning-preview',
      cronExpression: '47 6 * * *',
      timezone: timezone,
      task: sendPreviewForecast,
    });

    // 11:47 AM Puerto Rico (15 min antes de 12:02 PM)
    this.scheduler.schedule({
      name: 'forecast-noon-preview',
      cronExpression: '47 11 * * *',
      timezone: timezone,
      task: sendPreviewForecast,
    });
  }

  /**
   * Envía el forecast a MailChimp
   * Método privado de bajo nivel para envío paralelo
   */
  private async sendToMailChimp(forecastResult: ForecastResult): Promise<void> {
    if (!this.mailChimpAutomation) {
      return;
    }

    try {
      const result = await this.mailChimpAutomation.sendForecastCampaignAutomated(forecastResult);

      if (!result.success) {
        throw new Error(`MailChimp falló: ${result.error?.message || 'Error desconocido'}`);
      }
    } catch (error) {
      // No-fail: log pero no propagar el error
      this.logger.error('Error al enviar a MailChimp:', error);
      throw error; // Re-throw para que Promise.allSettled lo capture
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('Cerrando aplicación...');
    this.scheduler.stopAll();
    this.server.stop();
    await this.emailService.close();
    // DESACTIVADO: MailChimp
    // if (this.mailChimpService) {
    //   await this.mailChimpService.close();
    // }
    await this.browserService.close();
    this.logger.info('Aplicación cerrada');
  }

  /**
   * Ejecuta el envío de forecast inmediatamente (para pruebas manuales)
   * DESACTIVADO: Envío a todos los recipients
   * ACTIVO: Solo envía a PREVIEW_EMAILS
   */
  async runOnce(): Promise<void> {
    try {
      if (this.PREVIEW_EMAILS.length === 0) {
        this.logger.warn('⚠️  PREVIEW_EMAILS no está configurado - No se enviará email');
        return;
      }
      this.logger.info(`Ejecutando envío manual de forecast a ${this.PREVIEW_EMAILS.join(', ')}...`);
      await this.emailService.sendForecastReport({ to: this.PREVIEW_EMAILS });
      this.logger.info('Envío manual completado');
    } catch (error) {
      this.logger.error('Error en la ejecución:', error);
      throw error;
    }
  }

  /**
   * Obtiene la configuración de la aplicación
   */
  getConfig(): IConfig {
    return this.config;
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
    return await this.emailService.sendForecastReport({ to });
  }
}
