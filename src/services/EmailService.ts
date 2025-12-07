import nodemailer, { Transporter } from 'nodemailer';
import { Logger } from './Logger.js';
import { ForecastService, ForecastResult } from './ForecastService.js';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

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
    private isInitialized: boolean = false;
    private imageCache: Map<string, { buffer: Buffer; timestamp: number }> = new Map();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos
    private metrics = {
        emailsSent: 0,
        emailsFailed: 0,
        totalSendTime: 0
    };

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
     * Inicializa el transporter de email con connection pooling
     */
    async initialize(): Promise<void> {
        if (this.isInitialized && this.transporter) {
            return; // Ya está inicializado
        }

        try {
            this.logger.info('Inicializando servicio de email...');
            this.logger.info(`   Usuario: ${this.config.auth.user}`);

            // Configuración optimizada para Gmail con connection pooling
            this.transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: this.config.auth.user,
                    pass: this.config.auth.pass
                },
                pool: true, // Habilitar connection pooling
                maxConnections: 5, // Máximo de conexiones simultáneas
                maxMessages: 100, // Máximo de mensajes por conexión
                rateDelta: 1000, // Intervalo para rate limiting (1 segundo)
                rateLimit: 5 // Máximo de emails por rateDelta
            });

            // Verificar conexión
            await this.transporter.verify();
            
            this.isInitialized = true;
            this.logger.info('✅ Servicio de email inicializado con connection pooling');
        } catch (error) {
            this.logger.error('Error al inicializar servicio de email:', error);
            this.isInitialized = false;
            throw error;
        }
    }

    /**
     * Envía un email con retry automático
     */
    async send(options: EmailOptions, maxRetries: number = 3): Promise<boolean> {
        if (!this.isInitialized) {
            await this.initialize();
        }

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
            attachments: options.attachments?.map(att => ({
                filename: att.filename,
                path: att.path,
                content: att.content,
                contentType: att.contentType
            }))
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
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        return false;
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
     * Prepara el contenido del email del forecast (reutilizable para múltiples destinatarios)
     */
    private prepareForecastEmailContent(result: ForecastResult): { html: string; subject: string; imagePath: string } {
        const alertLevel = result.alertStatus.level as 'red' | 'yellow' | 'white';
        const imagePath = result.outputImagePath;

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
        .forecast-image { max-width: 100%; border-radius: 8px; margin: 15px 0; display: block; }
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
            <img src="cid:forecast-image" alt="Forecast Map" class="forecast-image" style="max-width: 100%; border-radius: 8px; display: block; margin: 0 auto;">
        </div>
        <div class="footer">
            <p>Este es un correo automático generado por Swim Safe Puerto Rico</p>
            <p>Para más información visite: weather.gov</p>
        </div>
    </div>
</body>
</html>
        `;

        return {
            html,
            subject: `${alert.emoji} Swim Safe PR - ${alert.title} - ${today}`,
            imagePath
        };
    }

    /**
     * Envía un email individual a un destinatario (método interno para envío en paralelo)
     */
    private async sendSingleEmail(
        to: string,
        subject: string,
        htmlContent: string,
        imageBuffer: Buffer,
        maxRetries: number = 3
    ): Promise<boolean> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const startTime = Date.now();
        
        const mailOptions = {
            from: this.config.auth.user,
            to: to,
            subject: subject,
            html: htmlContent,
            attachments: [{
                filename: 'forecast.png',
                content: imageBuffer,
                cid: 'forecast-image'
            }]
        };

        // Intentar enviar con retry
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await this.transporter!.sendMail(mailOptions);
                
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
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        return false;
    }

    /**
     * Envía emails a múltiples destinatarios en paralelo
     * @param to - Array de destinatarios
     * @param forecastResult - Resultado del forecast
     * @param batchSize - Tamaño del lote para envío paralelo (por defecto 5)
     * @returns Objeto con estadísticas de envío
     */
    async sendForecastReportParallel(
        to: string | string[],
        forecastResult?: ForecastResult,
        batchSize: number = 5
    ): Promise<{ success: number; failed: number; total: number }> {
        const recipients = Array.isArray(to) ? to : [to];
        const result = forecastResult || await this.forecastService.getForecast();
        
        // Preparar el email una sola vez
        const emailData = this.prepareForecastEmailContent(result);
        
        // Obtener imagen comprimida una sola vez
        const imageBuffer = await this.getImageBuffer(emailData.imagePath, true);
        
        this.logger.info(`Enviando ${recipients.length} emails en paralelo (lotes de ${batchSize})...`);
        
        let success = 0;
        let failed = 0;
        
        // Procesar en lotes para evitar sobrecarga
        for (let i = 0; i < recipients.length; i += batchSize) {
            const batch = recipients.slice(i, i + batchSize);
            
            const results = await Promise.allSettled(
                batch.map(recipient => 
                    this.sendSingleEmail(
                        recipient,
                        emailData.subject,
                        emailData.html,
                        imageBuffer
                    )
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
            
            this.logger.info(`Lote ${Math.floor(i / batchSize) + 1}: ${success} exitosos, ${failed} fallidos de ${i + batch.length}/${recipients.length}`);
        }
        
        this.logger.info(`✅ Envío completado: ${success} exitosos, ${failed} fallidos de ${recipients.length} totales`);
        
        return { success, failed, total: recipients.length };
    }

    /**
     * Envía el reporte del forecast con la imagen y detecta automáticamente el nivel de alerta
     * @param to - El destinatario del email
     * @param forecastResult - Resultado del forecast opcional (para reutilizar si ya se obtuvo)
     * @param useParallel - Si es true y hay múltiples destinatarios, usa envío en paralelo
     * @returns true si el reporte se envió correctamente, false en caso contrario  
     */
    async sendForecastReport(
        to: string | string[],
        forecastResult?: ForecastResult,
        useParallel: boolean = true
    ): Promise<boolean> {
        const recipients = Array.isArray(to) ? to : [to];
        
        // Si hay múltiples destinatarios y useParallel está habilitado, usar envío en paralelo
        if (recipients.length > 1 && useParallel) {
            const result = await this.sendForecastReportParallel(to, forecastResult);
            return result.failed === 0; // Retorna true solo si todos fueron exitosos
        }
        
        // Para un solo destinatario o si useParallel está deshabilitado, usar método normal
        const result = forecastResult || await this.forecastService.getForecast();
        const emailData = this.prepareForecastEmailContent(result);
        
        return await this.sendWithEmbeddedImage(
            to,
            emailData.subject,
            emailData.html,
            emailData.imagePath
        );
    }

    /**
     * Comprime una imagen para optimizar el tamaño del email
     * @param imageBuffer - Buffer de la imagen original
     * @param maxWidth - Ancho máximo (opcional, por defecto 800px)
     * @param quality - Calidad PNG (0-100, por defecto 85)
     * @returns Buffer de la imagen comprimida
     */
    private async compressImageForEmail(
        imageBuffer: Buffer,
        maxWidth: number = 800,
        quality: number = 85
    ): Promise<Buffer> {
        try {
            const metadata = await sharp(imageBuffer).metadata();
            const originalSize = imageBuffer.length;
            
            // Solo comprimir si la imagen es más grande que maxWidth
            if (metadata.width && metadata.width <= maxWidth) {
                this.logger.debug(`Imagen no necesita compresión (${metadata.width}px <= ${maxWidth}px)`);
                return imageBuffer;
            }

            const compressed = await sharp(imageBuffer)
                .resize(maxWidth, null, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .png({
                    quality: quality,
                    compressionLevel: 9
                })
                .toBuffer();

            const compressedSize = compressed.length;
            const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(1);
            
            this.logger.debug(`Imagen comprimida: ${(originalSize / 1024).toFixed(2)} KB → ${(compressedSize / 1024).toFixed(2)} KB (${reduction}% reducción)`);
            
            // Asegurar que es un Buffer estándar de Node.js
            return Buffer.from(compressed);
        } catch (error) {
            this.logger.warn('Error al comprimir imagen, usando original:', error);
            return imageBuffer; // Devolver original si falla la compresión
        }
    }

    /**
     * Obtiene la imagen desde cache o del disco, con compresión opcional
     */
    private async getImageBuffer(imagePath: string, compress: boolean = true): Promise<Buffer> {
        const now = Date.now();
        const cacheKey = `${imagePath}:${compress}`;
        
        // Verificar cache
        const cached = this.imageCache.get(cacheKey);
        if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
            this.logger.debug(`Imagen cargada desde cache: ${imagePath}`);
            return cached.buffer;
        }

        // Verificar que la imagen existe
        await fs.access(imagePath);
        
        // Leer imagen del disco
        let buffer: Buffer = await fs.readFile(imagePath);
        const originalSize = buffer.length;
        
        // Comprimir si está habilitado
        if (compress) {
            buffer = Buffer.from(await this.compressImageForEmail(buffer));
        }
        
        // Guardar en cache
        this.imageCache.set(cacheKey, { buffer, timestamp: now });
        this.logger.debug(`Imagen cargada y cacheada: ${imagePath} (${(buffer.length / 1024).toFixed(2)} KB${compress && buffer.length < originalSize ? ' comprimida' : ''})`);
        
        // Limpiar cache expirado periódicamente
        this.cleanExpiredCache();
        
        return buffer;
    }

    /**
     * Limpia entradas expiradas del cache
     */
    private cleanExpiredCache(): void {
        const now = Date.now();
        for (const [path, data] of this.imageCache.entries()) {
            if (now - data.timestamp >= this.CACHE_TTL) {
                this.imageCache.delete(path);
                this.logger.debug(`Cache expirado eliminado: ${path}`);
            }
        }
    }

    /**
     * Envía un email con una imagen embebida en el cuerpo (inline)
     * Optimizado con cache de imagen en memoria y compresión
     */
    async sendWithEmbeddedImage(
        to: string | string[],
        subject: string,
        htmlContent: string,
        imagePath: string,
        maxRetries: number = 3,
        compress: boolean = true
    ): Promise<boolean> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const startTime = Date.now();
        
        try {
            // Obtener imagen desde cache o disco (con compresión si está habilitada)
            const imageBuffer = await this.getImageBuffer(imagePath, compress);
            
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
                    content: imageBuffer, // Usar buffer en lugar de path para mejor performance
                    cid: 'forecast-image' // Content-ID referenciado en el HTML como src="cid:forecast-image"
                }]
            };

            // Intentar enviar con retry
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
                        this.logger.error(`Error al enviar email con imagen después de ${maxRetries} intentos:`, error);
                        throw error;
                    }
                    
                    // Backoff exponencial
                    const waitTime = 1000 * Math.pow(2, attempt - 1);
                    this.logger.warn(`Intento ${attempt} falló, reintentando en ${waitTime}ms...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
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
    getMetrics() {
        const avgTime = this.metrics.emailsSent > 0 
            ? (this.metrics.totalSendTime / this.metrics.emailsSent).toFixed(2)
            : '0';
        
        return {
            ...this.metrics,
            averageSendTime: parseFloat(avgTime),
            cacheSize: this.imageCache.size
        };
    }

    /**
     * Limpia el cache de imágenes
     */
    clearImageCache(): void {
        const size = this.imageCache.size;
        this.imageCache.clear();
        this.logger.info(`Cache de imágenes limpiado (${size} entradas eliminadas)`);
    }

    /**
     * Cierra la conexión del transporter
     */
    close(): void {
        if (this.transporter) {
            this.transporter.close();
            this.transporter = null;
            this.isInitialized = false;
            this.imageCache.clear();
            this.logger.info('Servicio de email cerrado');
        }
    }
}

