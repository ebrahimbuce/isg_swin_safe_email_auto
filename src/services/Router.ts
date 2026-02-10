import type { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import sharp from 'sharp';
import { Logger } from './Logger.js';
import { IConfig } from '../config/Config.js';
import { ForecastService } from './ForecastService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  params?: Record<string, string>
) => Promise<void>;

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

export class Router {
  private routes: Route[] = [];
  private readonly outputImagePath: string;
  /** Evita varias generaciones simultáneas cuando la imagen no existe */
  private generatingForecast: Promise<void> | null = null;

  constructor(
    private config: IConfig,
    private logger: Logger,
    private forecastService: ForecastService
  ) {
    this.outputImagePath = path.join(__dirname, '../../public/final/output.png');
    this.registerRoutes();
  }

  private registerRoutes(): void {
    // GET /status, /status/es, /status/en
    this.get(/^\/status(?:\/(es|en))?$/, ['lang'], this.handleStatus.bind(this));
    // GET /forecast/image - imagen actual del reporte (JPG, stream desde disco)
    this.get(/^\/forecast\/image$/, [], this.handleForecastImage.bind(this));
  }

  private get(pattern: RegExp, paramNames: string[], handler: RouteHandler): void {
    this.routes.push({ method: 'GET', pattern, paramNames, handler });
  }

  private match(pathname: string, method: string): { handler: RouteHandler; params: Record<string, string> } | null {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = pathname.match(route.pattern);
      if (!match) continue;
      const params: Record<string, string> = {};
      route.paramNames.forEach((name, i) => {
        params[name] = match[i + 1] ?? '';
      });
      return { handler: route.handler, params };
    }
    return null;
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const parsedUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method || 'GET';

    const matched = this.match(pathname, method);
    if (!matched) {
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not Found' }));
      return;
    }

    try {
      await matched.handler(req, res, matched.params);
    } catch (error) {
      this.logger.error('Error en ruta:', error);
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  }

  private async handleStatus(
    req: IncomingMessage,
    res: ServerResponse,
    params?: Record<string, string>
  ): Promise<void> {
    const parsedUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const lang = params?.lang || parsedUrl.searchParams.get('lang') || 'en';

    const status = await this.forecastService.checkCurrentStatus();

    let displayLabel = status.label;
    if (lang === 'es' && status.label_es) {
      displayLabel = status.label_es;
    } else if (lang === 'en' && status.label_en) {
      displayLabel = status.label_en;
    }

    const { label_en, label_es, description, ...cleanStatus } = status as typeof status & {
      label_en?: string;
      label_es?: string;
      description?: string;
    };

    const response = {
      ...cleanStatus,
      label: displayLabel,
      lang,
    };

    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify(response));
  }

  /**
   * Sirve la imagen actual del reporte en JPG (siempre lee del disco = siempre actualizada).
   * Si la imagen no existe, genera el forecast una vez y luego sirve (generación bajo demanda).
   */
  private async handleForecastImage(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const pathToFile = this.outputImagePath;

    try {
      await fs.access(pathToFile);
    } catch {
      // Generar bajo demanda: solo una generación a la vez
      if (!this.generatingForecast) {
        this.generatingForecast = this.forecastService
          .getForecast()
          .then(() => {
            this.logger.info('Forecast generado bajo demanda para /forecast/image');
          })
          .finally(() => {
            this.generatingForecast = null;
          });
      }
      try {
        await this.generatingForecast;
        await fs.access(pathToFile);
      } catch (err) {
        this.logger.error('Error generando forecast bajo demanda:', err);
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(503);
        res.end(
          JSON.stringify({
            error: 'No se pudo generar la imagen del forecast.',
            hint: 'Comprueba que Chromium esté instalado (npx playwright install chromium) y que la app tenga acceso a internet.',
          })
        );
        return;
      }
    }

    const filename = `swim-safe-forecast-${new Date().toISOString().slice(0, 10)}.jpg`;

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.writeHead(200);

    sharp(pathToFile)
      .jpeg({ quality: 85, chromaSubsampling: '4:2:0', mozjpeg: true })
      .on('error', (err) => {
        this.logger.error('Error sirviendo forecast image:', err);
        if (!res.writableEnded) {
          try {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Image error' }));
          } catch (_) {}
        }
      })
      .pipe(res);
  }
}
