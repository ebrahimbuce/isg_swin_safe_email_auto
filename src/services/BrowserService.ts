import puppeteer, { Browser, Page } from 'puppeteer';
import { Logger } from './Logger.js';

export class BrowserService {
    private browser: Browser | null = null;
    private page: Page | null = null;

    constructor(private logger: Logger) {}

    async initialize(): Promise<void> {
        try {
            this.logger.info('Inicializando navegador...');
            
            // Configuración para Railway/producción con Chromium
            const launchOptions: any = {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu'
                ]
            };

            // Usar Chromium de Railway si está disponible
            if (process.env.PUPPETEER_EXECUTABLE_PATH) {
                launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
            }

            this.browser = await puppeteer.launch(launchOptions);
            this.page = await this.browser.newPage();
            await this.page.setViewport({ width: 1920, height: 1080 });
            this.logger.info('Navegador inicializado correctamente');
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

