import { Logger } from './Logger.js';
import type { ForecastResult } from './dto/ForecastDTO.js';

export type AlertLevel = 'red' | 'yellow' | 'white';

export interface AlertEmailConfig {
  level: AlertLevel;
  emoji: string;
  title: string;
  message: string;
}

export interface EmailTemplateData {
  alertLevel: AlertLevel;
  alertEmoji: string;
  alertTitle: string;
  alertMessage: string;
  date: string;
}

/**
 * Servicio para generar contenido HTML de emails
 * Responsable de crear templates de emails para reportes de forecasts
 */
export class HTMLEmailGeneratorService {
  private readonly alertMessages: Record<AlertLevel, Omit<AlertEmailConfig, 'level'>> = {
    red: {
      emoji: '🔴',
      title: 'ALERTA ROJA - Corrientes Fuertes',
      message: 'Se han detectado condiciones peligrosas. Se recomienda NO nadar.',
    },
    yellow: {
      emoji: '🟡',
      title: 'PRECAUCIÓN - Corrientes Moderadas',
      message: 'Se han detectado corrientes moderadas. Nade con precaución.',
    },
    white: {
      emoji: '✅',
      title: 'CONDICIONES CALMADAS',
      message: 'Las condiciones del mar son favorables para nadar.',
    },
  };

  constructor(private logger: Logger) {}

  /**
   * Genera el contenido HTML del email de forecast
   */
  generateForecastEmailHTML(data: EmailTemplateData): string {
    // Preview text fijo (visible en inbox, oculto en email)
    const previewText = 'Compañía de Turismo de Puerto Rico';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #ffffff; }
        .container { max-width: 600px; margin: 0 auto; }
        .forecast-image { max-width: 100%; display: block; margin: 0 auto; }
        .preview-text { display: none; font-size: 1px; color: #ffffff; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; }
    </style>
</head>
<body>
    <span class="preview-text">${previewText}</span>
    <div class="container">
        <img src="cid:forecast-image" alt="Swim Safe Puerto Rico - Beach Conditions" class="forecast-image" style="max-width: 100%; display: block; margin: 0 auto;">
    </div>
</body>
</html>
    `;
  }

  /**
   * Prepara el template data a partir del resultado del forecast
   */
  prepareForecastTemplateData(forecastResult: ForecastResult): EmailTemplateData {
    const alertLevel = forecastResult.alertStatus.level as AlertLevel;
    const alert = this.alertMessages[alertLevel];
    const today = new Date().toLocaleDateString('es-PR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return {
      alertLevel,
      alertEmoji: alert.emoji,
      alertTitle: alert.title,
      alertMessage: alert.message,
      date: today,
    };
  }

  /**
   * Genera el asunto del email basado en el nivel de alerta
   */
  generateEmailSubject(data: EmailTemplateData): string {
    return 'SWIM SAFE PUERTO RICO';
  }

  /**
   * Método de conveniencia que genera todo el contenido del email de forecast
   */
  generateForecastEmail(forecastResult: ForecastResult): {
    html: string;
    subject: string;
  } {
    const templateData = this.prepareForecastTemplateData(forecastResult);
    const html = this.generateForecastEmailHTML(templateData);
    const subject = this.generateEmailSubject(templateData);

    this.logger.debug(`Email generado con nivel de alerta: ${templateData.alertLevel}`);

    return { html, subject };
  }
}
