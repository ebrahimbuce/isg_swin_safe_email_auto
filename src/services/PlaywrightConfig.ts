import { chromium, Browser, BrowserContext, LaunchOptions } from 'playwright';

/**
 * Configuración compartida de Playwright para Chromium
 * Centraliza todas las opciones de launch para evitar duplicación
 */
export class PlaywrightConfig {
    /**
     * Obtiene las opciones de launch optimizadas para servidores con poca RAM
     */
    static getLaunchOptions(): LaunchOptions {
        return {
            headless: true,
            timeout: 30000,  // Timeout de 30 segundos para iniciar
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-sync',
                '--disable-translate',
                '--disable-default-apps',
                '--no-first-run',
                '--no-zygote',
                // Optimizaciones de memoria mejoradas
                '--js-flags=--max-old-space-size=128',
                '--disable-accelerated-2d-canvas',
                '--disable-canvas-aa',
                '--disable-2d-canvas-clip-aa',
                '--disable-gl-drawing-for-tests',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-features=TranslateUI',
                '--disable-ipc-flooding-protection',
                '--memory-pressure-off',
                // Flags adicionales para evitar que se quede pegado
                '--disable-breakpad',
                '--disable-crash-reporter',
                '--disable-logging',
                '--disable-notifications',
                '--disable-permissions-api',
                '--disable-session-crashed-bubble',
                '--disable-web-security',
                '--no-crash-upload',
                '--no-pings',
                '--noerrdialogs',
                '--silent',
                '--disable-hang-monitor',
                '--disable-prompt-on-repost',
                '--disable-domain-reliability'
            ]
        };
    }

    /**
     * Busca Chrome/Chromium en rutas conocidas y lo agrega a las opciones
     */
    static async findChromeExecutable(launchOptions: LaunchOptions): Promise<void> {
        const chromePaths = [
            process.env.PLAYWRIGHT_EXECUTABLE_PATH || process.env.PUPPETEER_EXECUTABLE_PATH,
            '/usr/bin/google-chrome-stable',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium'
        ].filter(Boolean);

        const fs = await import('fs');
        for (const chromePath of chromePaths) {
            try {
                if (fs.existsSync(chromePath as string)) {
                    launchOptions.executablePath = chromePath;
                    break;
                }
            } catch {
                // Continuar buscando
            }
        }
    }

    /**
     * Lanza Chromium con timeout y mejor manejo de errores
     */
    static async launchWithTimeout(
        launchOptions: LaunchOptions,
        timeoutMs: number = 30000
    ): Promise<Browser> {
        // Buscar ejecutable si no está especificado
        if (!launchOptions.executablePath) {
            await this.findChromeExecutable(launchOptions);
        }

        const launchedBrowser = await Promise.race([
            chromium.launch(launchOptions),
            new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error(`Timeout: Chromium no inició en ${timeoutMs}ms`)), timeoutMs)
            )
        ]);

        if (!launchedBrowser) {
            throw new Error('Chromium no se inició correctamente');
        }

        return launchedBrowser;
    }

    /**
     * Crea un nuevo contexto de navegador con opciones optimizadas
     */
    static async createContext(browser: Browser, viewport?: { width: number; height: number; deviceScaleFactor?: number }): Promise<BrowserContext> {
        return await browser.newContext({
            viewport: viewport ? {
                width: viewport.width,
                height: viewport.height
            } : undefined,
            deviceScaleFactor: viewport?.deviceScaleFactor || 2,
            // Desactivar imágenes para ahorrar memoria (opcional, comentar si se necesitan)
            // ignoreHTTPSErrors: true
        });
    }
}

