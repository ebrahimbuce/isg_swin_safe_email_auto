import http from 'http';
import { Logger } from './Logger.js';
import { IConfig } from '../config/Config.js';
import { ForecastService } from './ForecastService.js';
import { Router } from './Router.js';

export class Server {
  private server: http.Server | null = null;
  private router: Router;

  constructor(
    private config: IConfig,
    private logger: Logger,
    private forecastService: ForecastService
  ) {
    this.router = new Router(config, logger, forecastService);
  }

  /**
   * Inicia el servidor HTTP
   */
  start(): void {
    this.server = http.createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      await this.router.handle(req, res);
    });

    this.server.listen(this.config.port, () => {
      this.logger.info(`🚀 Servidor HTTP escuchando en puerto ${this.config.port}`);
    });
  }

  /**
   * Detiene el servidor HTTP
   */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.logger.info('Servidor HTTP detenido');
    }
  }
}
