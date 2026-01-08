export interface EmailConfig {
  service?: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  appPassword: string;
}

export interface IConfig {
  port: number;
  nodeEnv: string;
  logLevel: string;
  apiUrl?: string;
  screenshotPath: string;
  email: EmailConfig;
  emailRecipients: string[];
  toJSON(): Record<string, any>;
}

export class Config implements IConfig {
  constructor(
    public readonly port: number,
    public readonly nodeEnv: string,
    public readonly logLevel: string,
    public readonly screenshotPath: string,
    public readonly email: EmailConfig,
    public readonly emailRecipients: string[],
    public readonly apiUrl?: string
  ) {}

  toJSON(): Record<string, any> {
    return {
      port: this.port,
      nodeEnv: this.nodeEnv,
      logLevel: this.logLevel,
      screenshotPath: this.screenshotPath,
      email: {
        service: this.email.service,
        host: this.email.host,
        port: this.email.port,
        secure: this.email.secure,
        user: this.email.user,
        appPassword: '***', // Ocultar contraseña
      },
      emailRecipients: this.emailRecipients,
      apiUrl: this.apiUrl,
    };
  }

  validate(): void {
    if (!this.port || this.port < 0 || this.port > 65535) {
      throw new Error('Puerto inválido');
    }
    if (!this.nodeEnv) {
      throw new Error('NODE_ENV es requerido');
    }
    if (!this.email.user) {
      throw new Error('GMAIL_USER es requerido');
    }
    if (!this.email.appPassword) {
      throw new Error('GMAIL_APP_PASSWORD es requerido');
    }
  }
}
