import { Logger } from './Logger.js';
import { ForecastService, ForecastResult } from './ForecastService.js';
import fs from 'fs/promises';
import path from 'path';

// Usaremos fetch nativo de Node.js (disponible desde Node 18+)
// Si necesitas compatibilidad con versiones anteriores, puedes usar node-fetch

export interface MailChimpConfig {
    apiKey: string;
    serverPrefix: string; // ej: 'us1', 'us2', 'us6', etc.
    listId?: string; // ID de la lista/audiencia
    fromEmail?: string;
    fromName?: string;
}

export interface MailChimpCampaignOptions {
    subject: string;
    htmlContent: string;
    textContent?: string;
    listId?: string;
    segmentId?: string; // Para enviar a un segmento específico
    imagePath?: string; // Ruta a la imagen para adjuntar
}

export interface MailChimpMember {
    email: string;
    firstName?: string;
    lastName?: string;
    status?: 'subscribed' | 'unsubscribed' | 'cleaned' | 'pending' | 'transactional';
}

export class MailChimpService {
    private baseUrl: string;
    private config: MailChimpConfig;
    private initialized: boolean = false;

    constructor(
        private logger: Logger,
        private forecastService: ForecastService,
        config?: Partial<MailChimpConfig>
    ) {
        this.config = {
            apiKey: config?.apiKey || process.env.MAILCHIMP_API_KEY || '',
            serverPrefix: config?.serverPrefix || process.env.MAILCHIMP_SERVER_PREFIX || 'us1',
            listId: config?.listId || process.env.MAILCHIMP_LIST_ID,
            fromEmail: config?.fromEmail || process.env.MAILCHIMP_FROM_EMAIL || '',
            fromName: config?.fromName || process.env.MAILCHIMP_FROM_NAME || 'Swim Safe Puerto Rico'
        };

        // Construir URL base de la API
        this.baseUrl = `https://${this.config.serverPrefix}.api.mailchimp.com/3.0`;
    }

    /**
     * Verifica la configuración y valida las credenciales
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            this.logger.info('Inicializando servicio de MailChimp...');
            this.logger.info(`   Server: ${this.config.serverPrefix}`);
            this.logger.info(`   List ID: ${this.config.listId || 'No configurado'}`);

            if (!this.config.apiKey) {
                throw new Error('MAILCHIMP_API_KEY no está configurado');
            }

            // Verificar credenciales haciendo una petición simple
            const response = await this.makeRequest('GET', '/');
            
            if (response.status === 'error') {
                throw new Error(`Error de autenticación: ${response.detail || 'Credenciales inválidas'}`);
            }

            this.initialized = true;
            this.logger.info('✅ Servicio de MailChimp inicializado correctamente');
        } catch (error) {
            this.logger.error('Error al inicializar servicio de MailChimp:', error);
            throw error;
        }
    }

    /**
     * Realiza una petición HTTP a la API de MailChimp
     */
    private async makeRequest(method: string, endpoint: string, body?: any): Promise<any> {
        const url = `${this.baseUrl}${endpoint}`;
        const auth = Buffer.from(`anystring:${this.config.apiKey}`).toString('base64');

        const options: RequestInit = {
            method,
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            }
        };

        if (body && method !== 'GET') {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url, options);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || data.title || `Error ${response.status}: ${response.statusText}`);
            }

            return data;
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`Error en petición a MailChimp: ${String(error)}`);
        }
    }

    /**
     * Crea y envía una campaña a la lista configurada
     */
    async sendCampaign(options: MailChimpCampaignOptions): Promise<boolean> {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const listId = options.listId || this.config.listId;
            if (!listId) {
                throw new Error('List ID no está configurado. Proporciona listId en las opciones o configura MAILCHIMP_LIST_ID');
            }

            this.logger.info('Creando campaña en MailChimp...');
            this.logger.info(`   Asunto: ${options.subject}`);
            this.logger.info(`   Lista: ${listId}`);

            // 1. Crear la campaña
            const campaign = await this.createCampaign(options.subject, listId);
            const campaignId = campaign.id;

            this.logger.info(`   Campaña creada: ${campaignId}`);

            // 2. Configurar el contenido HTML
            let htmlContent = options.htmlContent;
            
            // Si hay una imagen, convertirla a base64 y embebarla
            if (options.imagePath) {
                htmlContent = await this.embedImageInHtml(htmlContent, options.imagePath);
            }

            await this.setCampaignContent(campaignId, htmlContent, options.textContent);

            // 3. Enviar la campaña
            await this.sendCampaignNow(campaignId);

            this.logger.info('✅ Campaña enviada exitosamente');
            return true;
        } catch (error) {
            this.logger.error('Error al enviar campaña:', error);
            throw error;
        }
    }

    /**
     * Crea una nueva campaña
     */
    private async createCampaign(subject: string, listId: string): Promise<any> {
        const campaignData = {
            type: 'regular',
            recipients: {
                list_id: listId
            },
            settings: {
                subject_line: subject,
                from_name: this.config.fromName,
                reply_to: this.config.fromEmail || this.config.apiKey.split('-')[0] + '@mailchimp.com',
                to_name: '*|FNAME|* *|LNAME|*'
            }
        };

        return await this.makeRequest('POST', '/campaigns', campaignData);
    }

    /**
     * Establece el contenido HTML de la campaña
     */
    private async setCampaignContent(campaignId: string, htmlContent: string, textContent?: string): Promise<void> {
        const contentData: any = {
            html: htmlContent
        };

        if (textContent) {
            contentData.plain_text = textContent;
        }

        await this.makeRequest('PUT', `/campaigns/${campaignId}/content`, contentData);
    }

    /**
     * Envía la campaña inmediatamente
     */
    private async sendCampaignNow(campaignId: string): Promise<void> {
        await this.makeRequest('POST', `/campaigns/${campaignId}/actions/send`);
    }

    /**
     * Embebe una imagen en el HTML convirtiéndola a base64
     */
    private async embedImageInHtml(html: string, imagePath: string): Promise<string> {
        try {
            await fs.access(imagePath);
            const imageBuffer = await fs.readFile(imagePath);
            const imageBase64 = imageBuffer.toString('base64');
            const imageExtension = path.extname(imagePath).slice(1) || 'png';
            const dataUri = `data:image/${imageExtension};base64,${imageBase64}`;

            // Reemplazar cid:forecast-image con la imagen embebida
            return html.replace(/src="cid:forecast-image"/g, `src="${dataUri}"`);
        } catch (error) {
            this.logger.warn(`No se pudo embebir la imagen ${imagePath}, usando HTML original`);
            return html;
        }
    }

    /**
     * Envía el reporte del forecast como campaña de MailChimp
     * @param forecastResult - Resultado del forecast opcional (para reutilizar si ya se obtuvo)
     * @param listId - ID de la lista (opcional, usa la configurada por defecto)
     * @returns true si el reporte se envió correctamente
     */
    async sendForecastReport(forecastResult?: ForecastResult, listId?: string): Promise<boolean> {
        // Obtener el resultado del forecast si no se proporcionó uno
        const result = forecastResult || await this.forecastService.getForecast();
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

        return await this.sendCampaign({
            subject: `${alert.emoji} Swim Safe PR - ${alert.title} - ${today}`,
            htmlContent: html,
            listId: listId,
            imagePath: imagePath
        });
    }

    /**
     * Agrega un miembro a la lista
     */
    async addMember(member: MailChimpMember, listId?: string): Promise<boolean> {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const targetListId = listId || this.config.listId;
            if (!targetListId) {
                throw new Error('List ID no está configurado');
            }

            this.logger.info(`Agregando miembro a la lista: ${member.email}`);

            const memberData: any = {
                email_address: member.email,
                status: member.status || 'subscribed'
            };

            if (member.firstName || member.lastName) {
                memberData.merge_fields = {};
                if (member.firstName) memberData.merge_fields.FNAME = member.firstName;
                if (member.lastName) memberData.merge_fields.LNAME = member.lastName;
            }

            await this.makeRequest('POST', `/lists/${targetListId}/members`, memberData);

            this.logger.info(`✅ Miembro agregado exitosamente: ${member.email}`);
            return true;
        } catch (error: any) {
            // Si el miembro ya existe, no es un error crítico
            if (error.message && error.message.includes('already exists')) {
                this.logger.warn(`El miembro ${member.email} ya existe en la lista`);
                return true;
            }
            this.logger.error('Error al agregar miembro:', error);
            throw error;
        }
    }

    /**
     * Obtiene información de una lista
     */
    async getListInfo(listId?: string): Promise<any> {
        if (!this.initialized) {
            await this.initialize();
        }

        const targetListId = listId || this.config.listId;
        if (!targetListId) {
            throw new Error('List ID no está configurado');
        }

        return await this.makeRequest('GET', `/lists/${targetListId}`);
    }

    /**
     * Obtiene todos los miembros de una lista
     */
    async getListMembers(listId?: string, count: number = 10): Promise<any> {
        if (!this.initialized) {
            await this.initialize();
        }

        const targetListId = listId || this.config.listId;
        if (!targetListId) {
            throw new Error('List ID no está configurado');
        }

        return await this.makeRequest('GET', `/lists/${targetListId}/members?count=${count}`);
    }

    /**
     * Cierra/limpia el servicio
     */
    close(): void {
        this.initialized = false;
        this.logger.info('Servicio de MailChimp cerrado');
    }
}

