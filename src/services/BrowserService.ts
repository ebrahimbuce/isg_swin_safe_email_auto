import { Browser, Page, BrowserContext } from 'playwright';
import { Logger } from './Logger.js';
import { PlaywrightConfig } from './PlaywrightConfig.js';
import { InitializableService, InitializationResult } from './base/InitializableService.js';

export class BrowserService extends InitializableService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  constructor(logger: Logger) {
    super(logger);
  }

  protected getServiceName(): string {
    return 'Browser Service';
  }

  protected async doInitialize(): Promise<InitializationResult> {
    // Obtener configuración compartida de Playwright
    const launchOptions = PlaywrightConfig.getLaunchOptions();

    // Buscar Chrome en rutas conocidas
    await PlaywrightConfig.findChromeExecutable(launchOptions);
    const chromiumPath = launchOptions.executablePath;

    // Lanzar Chromium con timeout y mejor manejo de errores
    try {
      this.browser = await PlaywrightConfig.launchWithTimeout(launchOptions);
      this.context = await PlaywrightConfig.createContext(this.browser, {
        width: 1920,
        height: 1080,
      });
      this.page = await this.context.newPage();

      return {
        success: true,
        message: 'Chromium iniciado correctamente',
        details: chromiumPath
          ? {
              Executable: chromiumPath,
            }
          : undefined,
      };
    } catch (error) {
      throw new Error(`No se pudo iniciar Chromium: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  protected async doCleanup(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // Navegar a una URL específica
  async navigateTo(url: string): Promise<void> {
    if (!this.page) {
      throw new Error('El navegador no está inicializado');
    }
    this.logger.info(`Navegando a: ${url}`);
    await this.page.goto(url, { waitUntil: 'networkidle' });
  }

  async captureScreenshot(path: string): Promise<Buffer> {
    if (!this.page) {
      throw new Error('El navegador no está inicializado');
    }
    this.logger.debug(`Capturando screenshot: ${path}`);
    const screenshot = await this.page.screenshot({
      path,
      fullPage: true,
    });
    return screenshot;
  }

  // Obtener el contenido HTML completo de la página
  async getPageContent(): Promise<string> {
    if (!this.page) {
      throw new Error('El navegador no está inicializado');
    }
    return await this.page.content();
  }

  // Ejecutar un script en el contexto de la página
  async evaluateScript<T>(script: string | (() => T)): Promise<T> {
    if (!this.page) {
      throw new Error('El navegador no está inicializado');
    }
    return await this.page.evaluate(script);
  }

  // Cerrar el navegador y liberar recursos
  async close(): Promise<void> {
    await this.cleanup();
  }

  // Obtener la página actual
  getPage(): Page | null {
    return this.page;
  }

  // Obtener el navegador actual
  getBrowser(): Browser | null {
    return this.browser;
  }
}
