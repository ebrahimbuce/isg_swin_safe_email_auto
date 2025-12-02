import nodemailer, { Transporter } from 'nodemailer';
import { Logger } from './Logger.js';
import { ForecastService } from './ForecastService.js';
import fs from 'fs/promises';
import path from 'path';

export interface EmailConfig {
    host?: string;
    port?: number;
    secure?: boolean;
    service?: string;
    auth: {
        user: string;
        pass: string;
    };
}

export interface EmailOptions {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    attachments?: EmailAttachment[];
}

export interface EmailAttachment {
    filename: string;
    path?: string;
    content?: Buffer | string;
    contentType?: string;
}

export class EmailService {
    private transporter: Transporter | null = null;
    private config: EmailConfig;

    constructor(
        private logger: Logger,
        private forecastService: ForecastService,
        config?: Partial<EmailConfig>
    ) {
        // Configuración para Gmail usando variables de entorno 

        this.config = {
            service: 'gmail',
            auth: {
                user: config?.auth?.user || process.env.GMAIL_USER || '',
                pass: config?.auth?.pass || process.env.GMAIL_APP_PASSWORD || ''
            }
        };
    }

    
    /**
     * Inicializa el transporter de email
     */
    async initialize(): Promise<void> {
        try {
            this.logger.info('Inicializando servicio de email...');
            this.logger.info(`   Usuario: ${this.config.auth.user}`);

            // Configuración simplificada para Gmail
            this.transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: this.config.auth.user,
                    pass: this.config.auth.pass
                }
            });

            // Verificar conexión
            await this.transporter.verify();
            
            this.logger.info('✅ Servicio de email inicializado correctamente');
        } catch (error) {
            this.logger.error('Error al inicializar servicio de email:', error);
            throw error;
        }
    }

    /**
     * Envía un email
     */
    async send(options: EmailOptions): Promise<boolean> {
        if (!this.transporter) {
            await this.initialize();
        }

        try {
            const recipients = Array.isArray(options.to) ? options.to.join(', ') : options.to;
            
            this.logger.info(`Enviando email a: ${recipients}`);
            this.logger.info(`   Asunto: ${options.subject}`);

            const mailOptions = {
                from: this.config.auth.user,
                to: recipients,
                subject: options.subject,
                text: options.text,
                html: options.html,
                attachments: options.attachments?.map(att => ({
                    filename: att.filename,
                    path: att.path,
                    content: att.content,
                    contentType: att.contentType
                }))
            };

            const result = await this.transporter!.sendMail(mailOptions);

            this.logger.info(`✅ Email enviado exitosamente`);
            this.logger.info(`   Message ID: ${result.messageId}`);

            return true;
        } catch (error) {
            this.logger.error('Error al enviar email:', error);
            throw error;
        }
    }

    /**
     * Envía un email con una imagen adjunta
     */
    async sendWithImage(
        to: string | string[],
        subject: string,
        htmlContent: string,
        imagePath: string,
        imageFilename?: string
    ): Promise<boolean> {
        try {
            // Verificar que la imagen existe
            await fs.access(imagePath);
            
            const filename = imageFilename || path.basename(imagePath);

            return await this.send({
                to,
                subject,
                html: htmlContent,
                attachments: [{
                    filename,
                    path: imagePath,
                    contentType: 'image/png'
                }]
            });
        } catch (error) {
            this.logger.error('Error al enviar email con imagen:', error);
            throw error;
        }
    }

    /**
     * Envía el reporte del forecast con la imagen y detecta automáticamente el nivel de alerta
     * @param to - El destinatario del email
     * @returns true si el reporte se envió correctamente, false en caso contrario  
     */
    async sendForecastReport(to: string | string[]): Promise<boolean> {
        // Obtener el resultado del forecast (incluye alertStatus y outputImagePath)
        const forecastResult = await this.forecastService.getForecast();
        const alertLevel = forecastResult.alertStatus.level as 'red' | 'yellow' | 'white';
        const imagePath = forecastResult.outputImagePath;

        const alertMessages = {
            red: {
                emoji: '🔴',
                title: 'ALERTA ROJA - Corrientes Fuertes',
                message: 'Se han detectado condiciones peligrosas. Se recomienda NO nadar.'
            },
            yellow: {
                emoji: '🟡',
                title: 'PRECAUCIÓN - Corrientes Moderadas',
                message: 'Se han detectado corrientes moderadas. Nade con precaución.'
            },
            white: {
                emoji: '✅',
                title: 'CONDICIONES CALMADAS',
                message: 'Las condiciones del mar son favorables para nadar.'
            }
        };

        const alert = alertMessages[alertLevel];
        const today = new Date().toLocaleDateString('es-PR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(to right, #05998c, #3cb6c6); color: white; padding: 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 20px; }
        .alert-box { padding: 15px; border-radius: 8px; margin: 15px 0; text-align: center; }
        .alert-red { background: #ffebee; border: 2px solid #f44336; color: #c62828; }
        .alert-yellow { background: #fff8e1; border: 2px solid #ffc107; color: #f57f17; }
        .alert-white { background: #e8f5e9; border: 2px solid #4caf50; color: #2e7d32; }
        .alert-title { font-size: 20px; font-weight: bold; margin-bottom: 10px; }
        .date { color: #666; font-size: 14px; text-align: center; margin: 10px 0; }
        .footer { background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666; }
        .forecast-image { width: 100%; max-width: 500px; border-radius: 8px; margin: 15px 0; display: block; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏖️ Swim Safe Puerto Rico</h1>
            <p>Reporte Diario de Condiciones del Mar</p>
        </div>
        <div class="content">
            <p class="date">${today}</p>
            <div class="alert-box alert-${alertLevel}">
                <div class="alert-title">${alert.emoji} ${alert.title}</div>
                <p>${alert.message}</p>
            </div>
            <p style="text-align: center; margin-bottom: 10px;">Mapa de condiciones actuales de las playas de Puerto Rico:</p>
            <img src="cid:forecast-image" alt="Forecast Map" class="forecast-image" style="width: 100%; max-width: 500px; border-radius: 8px; display: block; margin: 0 auto;">
        </div>
        <div class="footer">
            <p>Este es un correo automático generado por Swim Safe Puerto Rico</p>
            <p>Para más información visite: weather.gov</p>
        </div>
    </div>
</body>
</html>
        `;

        return await this.sendWithEmbeddedImage(
            to,
            `${alert.emoji} Swim Safe PR - ${alert.title} - ${today}`,
            html,
            imagePath
        );
    }

    /**
     * Envía un email con una imagen embebida en el cuerpo (inline)
     */
    async sendWithEmbeddedImage(
        to: string | string[],
        subject: string,
        htmlContent: string,
        imagePath: string
    ): Promise<boolean> {
        if (!this.transporter) {
            await this.initialize();
        }

        try {
            // Verificar que la imagen existe
            await fs.access(imagePath);
            
            const recipients = Array.isArray(to) ? to.join(', ') : to;
            
            this.logger.info(`Enviando email con imagen embebida a: ${recipients}`);
            this.logger.info(`   Asunto: ${subject}`);

            const mailOptions = {
                from: this.config.auth.user,
                to: recipients,
                subject: subject,
                html: htmlContent,
                attachments: [{
                    filename: 'forecast.png',
                    path: imagePath,
                    cid: 'forecast-image' // Content-ID referenciado en el HTML como src="cid:forecast-image"
                }]
            };

            const result = await this.transporter!.sendMail(mailOptions);

            this.logger.info(`✅ Email enviado exitosamente`);
            this.logger.info(`   Message ID: ${result.messageId}`);

            return true;
        } catch (error) {
            this.logger.error('Error al enviar email con imagen embebida:', error);
            throw error;
        }
    }

    /**
     * Cierra la conexión del transporter
     */
    close(): void {
        if (this.transporter) {
            this.transporter.close();
            this.transporter = null;
            this.logger.info('Servicio de email cerrado');
        }
    }
}

