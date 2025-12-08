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
    return `
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
            <p class="date">${data.date}</p>
            <div class="alert-box alert-${data.alertLevel}">
                <div class="alert-title">${data.alertEmoji} ${data.alertTitle}</div>
                <p>${data.alertMessage}</p>
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
    return `${data.alertEmoji} Swim Safe PR - ${data.alertTitle} - ${data.date}`;
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
