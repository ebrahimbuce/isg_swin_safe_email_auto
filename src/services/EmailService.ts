import nodemailer, { Transporter } from 'nodemailer';
import type { SendMailOptions, SentMessageInfo } from 'nodemailer';
import { Logger } from './Logger.js';
import { ForecastService } from './ForecastService.js';
import { HTMLEmailGeneratorService } from './HTMLEmailGeneratorService.js';
import { ImageProcessorService } from './ImageProcessorService.js';
import { InitializableService, InitializationResult } from './base/InitializableService.js';
import fs from 'fs/promises';
import path from 'path';
import type {
  EmailConfig,
  EmailOptions,
  EmailAttachment,
  ForecastEmailData,
  EmailSendResult,
  EmailMetrics,
  SendParams,
  SendWithImageParams,
  SendWithEmbeddedImageParams,
  SendEmailParams,
  SendForecastReportParams,
  SendForecastParallelParams,
} from './dto/EmailDTO.js';
import type { ForecastResult } from './dto/ForecastDTO.js';

export type {
  EmailConfig,
  EmailOptions,
  EmailAttachment,
  ForecastEmailData,
  EmailSendResult,
  EmailMetrics,
  SendParams,
  SendWithImageParams,
  SendWithEmbeddedImageParams,
  SendEmailParams,
  SendForecastReportParams,
  SendForecastParallelParams,
};

export class EmailService extends InitializableService {
  private transporter: Transporter | null = null;
  private config: EmailConfig;
  private metrics = {
    emailsSent: 0,
    emailsFailed: 0,
    totalSendTime: 0,
  };

  constructor(
    logger: Logger,
    private forecastService: ForecastService,
    private htmlEmailGenerator: HTMLEmailGeneratorService,
    private imageProcessor: ImageProcessorService,
    config?: Partial<EmailConfig>
  ) {
    super(logger);
    // Configuración de email
    this.config = {
      service: config?.service,
      host: config?.host,
      port: config?.port,
      secure: config?.secure,
      auth: {
        user: config?.auth?.user || process.env.EMAIL_USER || process.env.GMAIL_USER || '',
        pass: config?.auth?.pass || process.env.EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD || '',
      },
    };

    // Si no se especifica servicio ni host, intentar usar Gmail por defecto si hay variables de entorno
    if (!this.config.service && !this.config.host) {
      this.config.service = 'gmail';
    }
  }

  protected getServiceName(): string {
    return 'Email Service';
  }

  /**
   * Implementación de la lógica de inicialización
   */
  protected async doInitialize(): Promise<InitializationResult> {
    const transportDefaults = {
      pool: true, // Habilitar connection pooling
      maxConnections: 5, // Máximo de conexiones simultáneas
      maxMessages: 100, // Máximo de mensajes por conexión
      rateDelta: 1000, // Intervalo para rate limiting (1 segundo)
      rateLimit: 5, // Máximo de emails por rateDelta
    };

    let transportConfig: any = {
      ...transportDefaults,
      auth: {
        user: this.config.auth.user,
        pass: this.config.auth.pass,
      },
    };

    if (this.config.service) {
      transportConfig.service = this.config.service;
    } else if (this.config.host) {
      transportConfig.host = this.config.host;
      if (this.config.port) transportConfig.port = this.config.port;
      if (this.config.secure !== undefined) transportConfig.secure = this.config.secure;
    } else {
      // Fallback a gmail
      transportConfig.service = 'gmail';
    }

    // Configuración optimizada con connection pooling
    this.transporter = nodemailer.createTransport(transportConfig);

    // Verificar conexión
    await this.transporter.verify();

    return {
      success: true,
      message: 'Connection pooling habilitado',
      details: {
        Config: this.config.service ? `Service: ${this.config.service}` : `Host: ${this.config.host}`,
        Usuario: this.config.auth.user,
      },
    };
  }

  protected async doCleanup(): Promise<void> {
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
    }
  }

  /**
   * Envía un email con retry automático
   */
  async send(params: SendParams): Promise<boolean> {
    const { options, maxRetries = 3 } = params;

    await this.ensureInitialized();

    const startTime = Date.now();
    const recipients = Array.isArray(options.to) ? options.to.join(', ') : options.to;

    this.logger.info(`Enviando email a: ${recipients}`);
    this.logger.info(`   Asunto: ${options.subject}`);

    const mailOptions = {
      from: this.config.auth.user,
      to: recipients,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments?.map((att) => ({
        filename: att.filename,
        path: att.path,
        content: att.content,
        contentType: att.contentType,
      })),
    };

    // Intentar enviar con retry y backoff exponencial
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.transporter!.sendMail(mailOptions);

        const duration = Date.now() - startTime;
        this.metrics.emailsSent++;
        this.metrics.totalSendTime += duration;

        this.logger.info(`✅ Email enviado exitosamente (intento ${attempt})`);
        this.logger.info(`   Message ID: ${result.messageId}`);
        this.logger.debug(`   Tiempo de envío: ${duration}ms`);

        return true;
      } catch (error) {
        if (attempt === maxRetries) {
          this.metrics.emailsFailed++;
          this.logger.error(`Error al enviar email después de ${maxRetries} intentos:`, error);
          throw error;
        }

        // Backoff exponencial: 1s, 2s, 4s
        const waitTime = 1000 * Math.pow(2, attempt - 1);
        this.logger.warn(`Intento ${attempt} falló, reintentando en ${waitTime}ms...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    return false;
  }

  /**
   * Envía un email con una imagen adjunta
   */
  async sendWithImage(params: SendWithImageParams): Promise<boolean> {
    const { to, subject, htmlContent, imagePath, imageFilename } = params;

    try {
      // Verificar que la imagen existe
      await fs.access(imagePath);

      const filename = imageFilename || path.basename(imagePath);

      return await this.send({
        options: {
          to,
          subject,
          html: htmlContent,
          attachments: [
            {
              filename,
              path: imagePath,
              contentType: 'image/png',
            },
          ],
        },
      });
    } catch (error) {
      this.logger.error('Error al enviar email con imagen:', error);
      throw error;
    }
  }

  /**
   * Prepara el contenido del email del forecast (reutilizable para múltiples destinatarios)
   */
  private prepareForecastEmailContent(result: ForecastResult): ForecastEmailData {
    const imagePath = result.outputImagePath;
    const { html, subject } = this.htmlEmailGenerator.generateForecastEmail(result);

    return {
      html,
      subject,
      imagePath,
    };
  }

  /**
   * Envía un email individual a un destinatario (método interno para envío en paralelo)
   */
  private async sendSingleEmail(params: SendEmailParams): Promise<boolean> {
    const { to, subject, htmlContent, imageBuffer, maxRetries = 3 } = params;

    await this.ensureInitialized();

    const startTime = Date.now();

    const mailOptions = {
      from: this.config.auth.user,
      to: to,
      subject: subject,
      html: htmlContent,
      attachments: [
        {
          filename: 'forecast.png',
          content: imageBuffer,
          cid: 'forecast-image',
        },
      ],
    };

    // Intentar enviar con retry
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.transporter!.sendMail(mailOptions);

        const duration = Date.now() - startTime;
        this.metrics.emailsSent++;
        this.metrics.totalSendTime += duration;

        this.logger.debug(`✅ Email enviado a ${to} (intento ${attempt}, ${duration}ms)`);
        return true;
      } catch (error) {
        if (attempt === maxRetries) {
          this.metrics.emailsFailed++;
          this.logger.error(`Error al enviar email a ${to} después de ${maxRetries} intentos:`, error);
          throw error;
        }

        const waitTime = 1000 * Math.pow(2, attempt - 1);
        this.logger.warn(`Intento ${attempt} falló para ${to}, reintentando en ${waitTime}ms...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    return false;
  }

  /**
   * Envía emails a múltiples destinatarios en paralelo
   * @param params - Parámetros para el envío en paralelo
   * @returns Objeto con estadísticas de envío
   */
  async sendForecastReportParallel(params: SendForecastParallelParams): Promise<EmailSendResult> {
    const { to, forecastResult, batchSize = 5 } = params;
    const recipients = Array.isArray(to) ? to : [to];
    const result = forecastResult || (await this.forecastService.getForecast());

    // Preparar el email una sola vez
    const emailData = this.prepareForecastEmailContent(result);

    // Obtener imagen comprimida una sola vez
    const imageBuffer = await this.imageProcessor.getImageBuffer({
      imagePath: emailData.imagePath,
      compress: true,
    });

    this.logger.info(`Enviando ${recipients.length} emails en paralelo (lotes de ${batchSize})...`);

    let success = 0;
    let failed = 0;

    // Procesar en lotes para evitar sobrecarga
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map((recipient) =>
          this.sendSingleEmail({
            to: recipient,
            subject: emailData.subject,
            htmlContent: emailData.html,
            imageBuffer,
          })
        )
      );

      results.forEach((r, idx) => {
        if (r.status === 'fulfilled' && r.value) {
          success++;
        } else {
          failed++;
          this.logger.warn(`Fallo al enviar a ${batch[idx]}:`, r.status === 'rejected' ? r.reason : 'Unknown error');
        }
      });

      this.logger.info(
        `Lote ${Math.floor(i / batchSize) + 1}: ${success} exitosos, ${failed} fallidos de ${i + batch.length}/${
          recipients.length
        }`
      );
    }

    this.logger.info(`✅ Envío completado: ${success} exitosos, ${failed} fallidos de ${recipients.length} totales`);

    return { success, failed, total: recipients.length };
  }

  /**
   * Envía el reporte del forecast con la imagen y detecta automáticamente el nivel de alerta
   * @param params - Parámetros para el envío del reporte
   * @returns true si el reporte se envió correctamente, false en caso contrario
   */
  async sendForecastReport(params: SendForecastReportParams): Promise<boolean> {
    const { to, forecastResult, useParallel = true } = params;
    const recipients = Array.isArray(to) ? to : [to];

    // Si hay múltiples destinatarios y useParallel está habilitado, usar envío en paralelo
    if (recipients.length > 1 && useParallel) {
      const result = await this.sendForecastReportParallel({ to, forecastResult });
      return result.failed === 0; // Retorna true solo si todos fueron exitosos
    }

    // Para un solo destinatario o si useParallel está deshabilitado, usar método normal
    const result = forecastResult || (await this.forecastService.getForecast());
    const emailData = this.prepareForecastEmailContent(result);

    return await this.sendWithEmbeddedImage({
      to,
      subject: emailData.subject,
      htmlContent: emailData.html,
      imagePath: emailData.imagePath,
    });
  }

  /**
   * Envía un email con una imagen embebida en el cuerpo (inline)
   * Optimizado con cache de imagen en memoria y compresión
   */
  async sendWithEmbeddedImage(params: SendWithEmbeddedImageParams): Promise<boolean> {
    const { to, subject, htmlContent, imagePath, maxRetries = 3, compress = true } = params;
    await this.ensureInitialized();

    const startTime = Date.now();

    try {
      // Obtener imagen desde cache o disco (con compresión si está habilitada)
      const imageBuffer = await this.imageProcessor.getImageBuffer({
        imagePath,
        compress,
      });

      const recipients = Array.isArray(to) ? to.join(', ') : to;

      this.logger.info(`Enviando email con imagen embebida a: ${recipients}`);
      this.logger.info(`   Asunto: ${subject}`);
      this.logger.info(`   Tamaño de imagen: ${(imageBuffer.length / 1024).toFixed(2)} KB`);
      const imageSizeKB = imageBuffer.length / 1024;
      if (imageSizeKB > 2000) {
        this.logger.warn(`   ⚠️  Imagen grande (${imageSizeKB.toFixed(2)} KB), se enviará adjunta e inline`);
      }

      // Enviar siempre como attachment con CID para que aparezca inline y descargable
      const filename = path.basename(imagePath) || 'forecast.png';
      const ext = path.extname(filename).toLowerCase();
      const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';

      const mailOptions: SendMailOptions = {
        from: this.config.auth.user,
        to: recipients,
        subject: subject,
        html: htmlContent,
        attachments: [
          {
            filename,
            content: imageBuffer,
            cid: 'forecast-image',
            contentDisposition: 'inline', // visible y descargable
            contentType,
          },
          {
            filename,
            content: imageBuffer,
            contentDisposition: 'attachment', // fuerza que aparezca como adjunto descargable
            contentType,
          },
        ],
      };

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result: SentMessageInfo = await this.transporter!.sendMail(mailOptions);

          const duration = Date.now() - startTime;
          this.metrics.emailsSent++;
          this.metrics.totalSendTime += duration;

          this.logger.info(`✅ Email enviado exitosamente (inline + adjunto) (intento ${attempt})`);
          this.logger.info(`   Message ID: ${result.messageId}`);
          this.logger.info(`   Destinatarios aceptados: ${result.accepted?.join(', ') || 'N/A'}`);
          this.logger.info(`   Destinatarios rechazados: ${result.rejected?.join(', ') || 'Ninguno'}`);
          this.logger.debug(`   Tiempo de envío: ${duration}ms`);

          return true;
        } catch (error) {
          if (attempt === maxRetries) {
            this.metrics.emailsFailed++;
            this.logger.error(`Error al enviar email con imagen después de ${maxRetries} intentos:`, error);
            throw error;
          }

          // Backoff exponencial
          const waitTime = 1000 * Math.pow(2, attempt - 1);
          this.logger.warn(`Intento ${attempt} falló, reintentando en ${waitTime}ms...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }

      return false;
    } catch (error) {
      this.logger.error('Error al enviar email con imagen embebida:', error);
      throw error;
    }
  }

  /**
   * Obtiene métricas del servicio de email
   */
  getMetrics(): EmailMetrics {
    const avgTime =
      this.metrics.emailsSent > 0 ? (this.metrics.totalSendTime / this.metrics.emailsSent).toFixed(2) : '0';

    return {
      ...this.metrics,
      averageSendTime: parseFloat(avgTime),
      cacheSize: this.imageProcessor.getCacheSize(),
    };
  }

  /**
   * Limpia el cache de imágenes
   */
  clearImageCache(): void {
    this.imageProcessor.clearImageCache();
  }

  /**
   * Cierra la conexión del transporter
   */
  async close(): Promise<void> {
    if (this.transporter) {
      this.imageProcessor.clearImageCache();
    }
    await this.cleanup();
  }
}
