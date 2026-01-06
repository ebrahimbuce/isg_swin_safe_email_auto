import http from 'http';
import { URL } from 'url';
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

      const parsedUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const pathName = parsedUrl.pathname;

      // Soporta /status, /status/es, /status/en
      const statusMatch = pathName.match(/^\/status(?:\/(es|en))?$/);

      if (statusMatch && req.method === 'GET') {
        const lang = statusMatch[1] || parsedUrl.searchParams.get('lang') || 'en';

        try {
          const status = await this.forecastService.checkCurrentStatus();

          // Selección de idioma para la etiqueta
          let displayLabel = status.label;
          if (lang === 'es' && status.label_es) {
            displayLabel = status.label_es;
          } else if (lang === 'en' && status.label_en) {
            displayLabel = status.label_en;
          }

          // Eliminar campos auxiliares internos de la respuesta pública
          const { label_en, label_es, description, ...cleanStatus } = status as any;

          const response = {
            ...cleanStatus,
            label: displayLabel, // Sobrescribe con la versión traducida seleccionada
            lang: lang, // Indicar el idioma devuelto
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
