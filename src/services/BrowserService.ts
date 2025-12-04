import puppeteer, { Browser, Page } from 'puppeteer';
import { Logger } from './Logger.js';
import { PuppeteerConfig } from './PuppeteerConfig.js';

export class BrowserService {
    private browser: Browser | null = null;
    private page: Page | null = null;

    constructor(private logger: Logger) {}

    async initialize(): Promise<void> {
        try {
            this.logger.info('Inicializando navegador...');
            
            // Obtener configuración compartida de Puppeteer
            const launchOptions = PuppeteerConfig.getLaunchOptions();
            
            // Buscar Chrome en rutas conocidas
            await PuppeteerConfig.findChromeExecutable(launchOptions);
            if (launchOptions.executablePath) {
                this.logger.info(`Usando Chrome: ${launchOptions.executablePath}`);
            }

            // Lanzar Chrome con timeout y mejor manejo de errores
            this.logger.info('Iniciando Chrome (esto puede tomar unos segundos)...');
            try {
                this.browser = await PuppeteerConfig.launchWithTimeout(launchOptions);
                this.logger.info('Chrome iniciado correctamente');
                this.page = await this.browser.newPage();
                await this.page.setViewport({ width: 1920, height: 1080 });
                this.logger.info('Navegador inicializado correctamente');
            } catch (error) {
                this.logger.error('Error al iniciar Chrome:', error);
                throw new Error(`No se pudo iniciar Chrome: ${error instanceof Error ? error.message : 'Error desconocido'}`);
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
        await this.page.goto(url, { waitUntil: 'networkidle2' });
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
        return screenshot as Buffer;
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

