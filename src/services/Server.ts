import http from 'http';
import { Logger } from './Logger.js';
import { IConfig } from '../config/Config.js';
import { ForecastService } from './ForecastService.js';

export class Server {
  private server: http.Server | null = null;

  constructor(private config: IConfig, private logger: Logger, private forecastService: ForecastService) {}

  /**
   * Inicia el servidor HTTP
   */
  start(): void {
    this.server = http.createServer(async (req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');

      if (req.url === '/status' && req.method === 'GET') {
        try {
          const status = await this.forecastService.checkCurrentStatus();

          // Map level to high/moderate/low for the API response
          const mappedLevel = status.level === 'red' ? 'high' : status.level === 'yellow' ? 'moderate' : 'low';

          const response = {
            ...status,
            level: mappedLevel,
          };

          res.writeHead(200);
          res.end(JSON.stringify(response));
        } catch (error) {
          this.logger.error('Error en endpoint /status:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not Found' }));
      }
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
