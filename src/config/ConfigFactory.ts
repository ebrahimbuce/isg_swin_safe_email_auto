import { Config, EmailConfig } from './Config.js';

export class ConfigFactory {
  static fromEnv(): Config {
    const appPort = parseInt(process.env.PORT || '3000', 10);
    const nodeEnv = process.env.NODE_ENV || 'development';
    const logLevel = process.env.LOG_LEVEL || 'info';
    const apiUrl = process.env.API_URL;
    const screenshotPath = process.env.SCREENSHOT_PATH || './screenshots';

    // Configuración de Email (Genérica)
    const host = process.env.EMAIL_HOST || process.env.GMAIL_HOST || 'smtp.gmail.com';
    const emailPort = parseInt(process.env.EMAIL_PORT || process.env.GMAIL_PORT || '587', 10);
    const secure = process.env.EMAIL_SECURE === 'true' || emailPort === 465;
    const user = process.env.EMAIL_USER || process.env.GMAIL_USER || '';
    const appPassword = process.env.EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD || '';
    const service = process.env.EMAIL_SERVICE; // Opcional, si se define usa el service de nodemailer

    const emailConfig: EmailConfig = {
      service,
      host,
      port: emailPort,
      secure,
      user,
      appPassword,
    };

    // Destinatarios de email (separados por coma)
    const emailRecipients = (process.env.EMAIL_RECIPIENTS || '')
      .split(',')
      .map((email) => email.trim())
      .filter((email) => email.length > 0);

    const config = new Config(appPort, nodeEnv, logLevel, screenshotPath, emailConfig, emailRecipients, apiUrl);

    config.validate();
    return config;
  }

  static fromObject(obj: Record<string, any>): Config {
    return new Config(
      obj.port || 3000,
      obj.nodeEnv || 'development',
      obj.logLevel || 'info',
      obj.screenshotPath || './screenshots',
      obj.email || obj.gmail || { host: 'smtp.gmail.com', port: 587, secure: false, user: '', appPassword: '' },
      obj.emailRecipients || [],
      obj.apiUrl
    );
  }
}
