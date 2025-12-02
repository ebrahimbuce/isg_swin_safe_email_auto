import { Config, EmailConfig } from './Config.js';

export class ConfigFactory {
    static fromEnv(): Config {
        const port = parseInt(process.env.PORT || '3000', 10);
        const nodeEnv = process.env.NODE_ENV || 'development';
        const logLevel = process.env.LOG_LEVEL || 'info';
        const apiUrl = process.env.API_URL;
        const screenshotPath = process.env.SCREENSHOT_PATH || './screenshots';

        // Configuración de Gmail
        const gmail: EmailConfig = {
            host: process.env.GMAIL_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.GMAIL_PORT || '587', 10),
            user: process.env.GMAIL_USER || '',
            appPassword: process.env.GMAIL_APP_PASSWORD || ''
        };

        // Destinatarios de email (separados por coma)
        const emailRecipients = (process.env.EMAIL_RECIPIENTS || '')
            .split(',')
            .map(email => email.trim())
            .filter(email => email.length > 0);

        const config = new Config(
            port,
            nodeEnv,
            logLevel,
            screenshotPath,
            gmail,
            emailRecipients,
            apiUrl
        );

        config.validate();
        return config;
    }

    static fromObject(obj: Record<string, any>): Config {
        return new Config(
            obj.port || 3000,
            obj.nodeEnv || 'development',
            obj.logLevel || 'info',
            obj.screenshotPath || './screenshots',
            obj.gmail || { host: 'smtp.gmail.com', port: 587, user: '', appPassword: '' },
            obj.emailRecipients || [],
            obj.apiUrl
        );
    }
}

