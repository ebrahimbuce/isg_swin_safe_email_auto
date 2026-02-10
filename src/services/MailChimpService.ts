import { Logger } from './Logger.js';
import type { ForecastResult } from './dto/ForecastDTO.js';
import { InitializableService, InitializationResult } from './base/InitializableService.js';
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
  previewText?: string; // Texto de preview para el inbox
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

export class MailChimpService extends InitializableService {
  private baseUrl: string;
  private config: MailChimpConfig;

  constructor(logger: Logger, config?: Partial<MailChimpConfig>) {
    super(logger);
    this.config = {
      apiKey: config?.apiKey || process.env.MAILCHIMP_API_KEY || '',
      serverPrefix: config?.serverPrefix || process.env.MAILCHIMP_SERVER_PREFIX || 'us1',
      listId: config?.listId || process.env.MAILCHIMP_LIST_ID,
      fromEmail: config?.fromEmail || process.env.MAILCHIMP_FROM_EMAIL || '',
      fromName: config?.fromName || process.env.MAILCHIMP_FROM_NAME || 'Swim Safe Puerto Rico',
    };

    // Construir URL base de la API
    this.baseUrl = `https://${this.config.serverPrefix}.api.mailchimp.com/3.0`;
  }

  protected getServiceName(): string {
    return 'MailChimp Service';
  }

  /**
   * Implementación de la lógica de inicialización
   */
  protected async doInitialize(): Promise<InitializationResult> {
    if (!this.config.apiKey) {
      throw new Error('MAILCHIMP_API_KEY no está configurado');
    }

    // Verificar credenciales haciendo una petición simple
    const response = await this.makeRequest('GET', '/');

    if (response.status === 'error') {
      throw new Error(`Error de autenticación: ${response.detail || 'Credenciales inválidas'}`);
    }

    return {
      success: true,
      message: 'Conexión establecida con MailChimp API',
      details: {
        Server: this.config.serverPrefix,
        'List ID': this.config.listId || 'No configurado',
      },
    };
  }

  protected async doCleanup(): Promise<void> {
    // No hay recursos específicos que limpiar en MailChimp
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
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);

      // Si la respuesta es exitosa pero no tiene contenido (204 No Content)
      if (response.ok && response.status === 204) {
        return { success: true };
      }

      // Si la respuesta está vacía, retornar objeto vacío
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

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
    await this.ensureInitialized();

    try {
      const listId = options.listId || this.config.listId;
      if (!listId) {
        throw new Error(
          'List ID no está configurado. Proporciona listId en las opciones o configura MAILCHIMP_LIST_ID'
        );
      }

      this.logger.info('Creando campaña en MailChimp...');
      this.logger.info(`   Asunto: ${options.subject}`);
      this.logger.info(`   Lista: ${listId}`);

      // 1. Crear la campaña
      const campaign = await this.createCampaign(options.subject, listId, options.previewText);
      const campaignId = campaign.id;

      this.logger.info(`   Campaña creada: ${campaignId}`);

      // 2. Configurar el contenido HTML
      let htmlContent = options.htmlContent;

      // Si hay una imagen, subirla a MailChimp y obtener URL
      if (options.imagePath) {
        htmlContent = await this.embedImageInHtmlWithMailChimpURL(htmlContent, options.imagePath);
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
  private async createCampaign(subject: string, listId: string, previewText?: string): Promise<any> {
    const campaignData = {
      type: 'regular',
      recipients: {
        list_id: listId,
      },
      settings: {
        subject_line: subject,
        preview_text: previewText || '',
        from_name: this.config.fromName,
        reply_to: this.config.fromEmail || this.config.apiKey.split('-')[0] + '@mailchimp.com',
        to_name: '*|FNAME|* *|LNAME|*',
      },
    };

    return await this.makeRequest('POST', '/campaigns', campaignData);
  }

  /**
   * Establece el contenido HTML de la campaña
   */
  private async setCampaignContent(campaignId: string, htmlContent: string, textContent?: string): Promise<void> {
    const contentData: any = {
      html: htmlContent,
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
   * Sube una imagen al servidor de MailChimp y retorna la URL
   */
  private async uploadImageToMailChimp(imagePath: string, fileName: string = 'forecast.png'): Promise<string> {
    try {
      this.logger.info(`📤 Subiendo imagen a MailChimp: ${imagePath}`);

      await fs.access(imagePath);
      const imageBuffer = await fs.readFile(imagePath);
      const imageBase64 = imageBuffer.toString('base64');

      this.logger.info(`   ✓ Imagen leída: ${(imageBuffer.length / 1024).toFixed(2)} KB`);

      // Subir imagen a MailChimp File Manager
      const uploadData = {
        name: fileName,
        file_data: imageBase64,
        folder_id: 0, // Root folder
      };

      const result = await this.makeRequest('POST', '/file-manager/files', uploadData);

      this.logger.info(`   ✓ Imagen subida exitosamente: ${result.full_size_url}`);

      return result.full_size_url;
    } catch (error) {
      this.logger.error(`❌ Error al subir imagen a MailChimp:`, error);
      throw error;
    }
  }

  /**
   * Embebe una imagen en el HTML usando URL de MailChimp
   */
  private async embedImageInHtmlWithMailChimpURL(html: string, imagePath: string): Promise<string> {
    try {
      this.logger.info(`📷 Procesando imagen para MailChimp: ${imagePath}`);

      // Generar nombre único para evitar colisiones
      const timestamp = Date.now();
      const fileName = `forecast-${timestamp}.png`;

      // Subir imagen a MailChimp
      const imageUrl = await this.uploadImageToMailChimp(imagePath, fileName);

      // Verificar si el HTML contiene cid:forecast-image
      const hasCID = html.includes('cid:forecast-image');
      this.logger.info(`   ${hasCID ? '✓' : '⚠️ '} HTML ${hasCID ? 'contiene' : 'NO contiene'} cid:forecast-image`);

      // Reemplazar cid:forecast-image con la URL de MailChimp
      const htmlWithImage = html.replace(/src="cid:forecast-image"/g, `src="${imageUrl}"`);

      // Verificar que el reemplazo funcionó
      const hasImageUrl = htmlWithImage.includes(imageUrl);
      this.logger.info(`   ${hasImageUrl ? '✓' : '❌'} Reemplazo ${hasImageUrl ? 'exitoso' : 'FALLÓ'}`);

      if (!hasImageUrl && hasCID) {
        this.logger.error('   ❌ ERROR: El HTML tenía CID pero el reemplazo no funcionó');
      }

      return htmlWithImage;
    } catch (error) {
      this.logger.error(`❌ Error al procesar imagen:`, error);
      // Fallback: intentar con base64 inline
      this.logger.warn('   ⚠️  Intentando fallback con base64 inline...');
      return await this.embedImageInHtmlWithBase64(html, imagePath);
    }
  }

  /**
   * Embebe una imagen en el HTML convirtiéndola a base64 (fallback)
   */
  private async embedImageInHtmlWithBase64(html: string, imagePath: string): Promise<string> {
    try {
      this.logger.info(`📷 Fallback: Embebiendo imagen en base64`);

      await fs.access(imagePath);
      const imageBuffer = await fs.readFile(imagePath);
      const imageBase64 = imageBuffer.toString('base64');
      const imageExtension = path.extname(imagePath).slice(1) || 'png';
      const dataUri = `data:image/${imageExtension};base64,${imageBase64}`;

      this.logger.info(`   ✓ Base64 generado: ${(imageBase64.length / 1024).toFixed(2)} KB`);

      const htmlWithImage = html.replace(/src="cid:forecast-image"/g, `src="${dataUri}"`);

      return htmlWithImage;
    } catch (error) {
      this.logger.error(`❌ Error al embebir imagen ${imagePath}:`, error);
      this.logger.warn('   Usando HTML original sin imagen');
      return html;
    }
  }

  /**
   * Método de conveniencia: Envía una campaña con HTML generado y una imagen
   * @param subject - Asunto del email
   * @param htmlContent - Contenido HTML generado
   * @param imagePath - Ruta de la imagen a embeber
   * @param listId - ID de la lista (opcional)
   * @param previewText - Texto de preview para el inbox (opcional)
   */
  async sendCampaignWithHTML(
    subject: string,
    htmlContent: string,
    imagePath: string,
    listId?: string,
    previewText?: string
  ): Promise<boolean> {
    return await this.sendCampaign({
      subject,
      htmlContent,
      listId,
      imagePath,
      previewText,
    });
  }

  /**
   * Crea una nueva lista/audiencia en MailChimp
   */
  async createList(listData: any): Promise<any> {
    await this.ensureInitialized();
    return await this.makeRequest('POST', '/lists', listData);
  }

  /**
   * Obtiene todas las listas/audiencias
   */
  async getLists(): Promise<any> {
    await this.ensureInitialized();
    return await this.makeRequest('GET', '/lists');
  }

  /**
   * Agrega un miembro a la lista
   */
  async addMember(member: MailChimpMember, listId?: string): Promise<boolean> {
    await this.ensureInitialized();

    try {
      const targetListId = listId || this.config.listId;
      if (!targetListId) {
        throw new Error('List ID no está configurado');
      }

      this.logger.info(`Agregando miembro a la lista: ${member.email}`);

      const memberData: any = {
        email_address: member.email,
        status: member.status || 'subscribed',
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
    await this.ensureInitialized();

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
    await this.ensureInitialized();

    const targetListId = listId || this.config.listId;
    if (!targetListId) {
      throw new Error('List ID no está configurado');
    }

    return await this.makeRequest('GET', `/lists/${targetListId}/members?count=${count}`);
  }

  /**
   * Cierra/limpia el servicio
   */
  async close(): Promise<void> {
    await this.cleanup();
  }
}
