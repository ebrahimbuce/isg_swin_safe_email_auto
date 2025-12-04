import puppeteer from 'puppeteer';

/**
 * Configuración compartida de Puppeteer para Chrome
 * Centraliza todas las opciones de launch para evitar duplicación
 */
export class PuppeteerConfig {
    /**
     * Obtiene las opciones de launch optimizadas para servidores con poca RAM
     */
    static getLaunchOptions(): any {
        return {
            headless: 'new' as any,
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
     * Busca Chrome en rutas conocidas y lo agrega a las opciones
     */
    static async findChromeExecutable(launchOptions: puppeteer.LaunchOptions): Promise<void> {
        const chromePaths = [
            process.env.PUPPETEER_EXECUTABLE_PATH,
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
     * Lanza Chrome con timeout y mejor manejo de errores
     */
    static async launchWithTimeout(
        launchOptions: puppeteer.LaunchOptions,
        timeoutMs: number = 30000
    ): Promise<puppeteer.Browser> {
        const launchedBrowser = await Promise.race([
            puppeteer.launch(launchOptions),
            new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error(`Timeout: Chrome no inició en ${timeoutMs}ms`)), timeoutMs)
            )
        ]);

        if (!launchedBrowser) {
            throw new Error('Chrome no se inició correctamente');
        }

        return launchedBrowser;
    }
}

