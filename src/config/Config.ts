export interface EmailConfig {
    host: string;
    port: number;
    user: string;
    appPassword: string;
}

export interface IConfig {
    port: number;
    nodeEnv: string;
    logLevel: string;
    apiUrl?: string;
    screenshotPath: string;
    gmail: EmailConfig;
    emailRecipients: string[];
    toJSON(): Record<string, any>;
}

export class Config implements IConfig {
    constructor(
        public readonly port: number,
        public readonly nodeEnv: string,
        public readonly logLevel: string,
        public readonly screenshotPath: string,
        public readonly gmail: EmailConfig,
        public readonly emailRecipients: string[],
        public readonly apiUrl?: string
    ) {}

    toJSON(): Record<string, any> {
        return {
            port: this.port,
            nodeEnv: this.nodeEnv,
            logLevel: this.logLevel,
            screenshotPath: this.screenshotPath,
            gmail: {
                host: this.gmail.host,
                port: this.gmail.port,
                user: this.gmail.user,
                appPassword: '***' // Ocultar contraseña
            },
            emailRecipients: this.emailRecipients,
            apiUrl: this.apiUrl
        };
    }

    validate(): void {
        if (!this.port || this.port < 0 || this.port > 65535) {
            throw new Error('Puerto inválido');
        }
        if (!this.nodeEnv) {
            throw new Error('NODE_ENV es requerido');
        }
        if (!this.gmail.user) {
            throw new Error('GMAIL_USER es requerido');
        }
        if (!this.gmail.appPassword) {
            throw new Error('GMAIL_APP_PASSWORD es requerido');
        }
    }
}

