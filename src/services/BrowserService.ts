import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { Logger } from './Logger.js';
import { PlaywrightConfig } from './PlaywrightConfig.js';

export class BrowserService {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;

    constructor(private logger: Logger) {}

    async initialize(): Promise<void> {
        try {
            this.logger.info('Inicializando navegador...');
            
            // Obtener configuración compartida de Playwright
            const launchOptions = PlaywrightConfig.getLaunchOptions();
            
            // Buscar Chrome en rutas conocidas
            await PlaywrightConfig.findChromeExecutable(launchOptions);
            if (launchOptions.executablePath) {
                this.logger.info(`Usando Chromium: ${launchOptions.executablePath}`);
            }

            // Lanzar Chromium con timeout y mejor manejo de errores
            this.logger.info('Iniciando Chromium (esto puede tomar unos segundos)...');
            try {
                this.browser = await PlaywrightConfig.launchWithTimeout(launchOptions);
                this.logger.info('Chromium iniciado correctamente');
                this.context = await PlaywrightConfig.createContext(this.browser, {
                    width: 1920,
                    height: 1080
                });
                this.page = await this.context.newPage();
                this.logger.info('Navegador inicializado correctamente');
            } catch (error) {
                this.logger.error('Error al iniciar Chromium:', error);
                throw new Error(`No se pudo iniciar Chromium: ${error instanceof Error ? error.message : 'Error desconocido'}`);
            }
        } catch (error) {
            this.logger.error('Error al inicializar el navegador:', error);
            throw error;
        }
    }

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
            fullPage: true 
        });
        return screenshot;
    }

    async getPageContent(): Promise<string> {
        if (!this.page) {
            throw new Error('El navegador no está inicializado');
        }
        return await this.page.content();
    }

    async evaluateScript<T>(script: string | (() => T)): Promise<T> {
        if (!this.page) {
            throw new Error('El navegador no está inicializado');
        }
        return await this.page.evaluate(script);
    }

    async close(): Promise<void> {
        if (this.context) {
            await this.context.close();
            this.context = null;
        }
        if (this.browser) {
            this.logger.info('Cerrando navegador...');
            await this.browser.close();
            this.browser = null;
            this.page = null;
            this.logger.info('Navegador cerrado');
        }
    }

    getPage(): Page | null {
        return this.page;
    }

    getBrowser(): Browser | null {
        return this.browser;
    }
}

