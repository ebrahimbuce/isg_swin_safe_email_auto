import { Logger } from "./Logger.js";
import { ColorDetectionResult } from "./ImageProcessorService.js";
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { chromium, Browser, Page, BrowserContext } from 'playwright';
import sharp from 'sharp';
import { PlaywrightConfig } from './PlaywrightConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type AlertLevel = 'red' | 'yellow' | 'white';

export interface AlertStatus {
    level: AlertLevel;
    label: string;
    description: string;
}

export class HTMLGeneratorService {
    private templatePath: string;
    private outputPath: string;

    constructor(private logger: Logger) {
        this.templatePath = path.join(__dirname, '../../public/index.html');
        this.outputPath = path.join(__dirname, '../../public/index.html');
    }

    /**
     * Determina el nivel de alerta basado en la detección de colores
     * Prioridad: Rojo > Amarillo > Blanco
     * Cualquier presencia mínima de color activa la alerta
     */
    determineAlertLevel(detection: ColorDetectionResult): AlertStatus {
        // Umbral mínimo: cualquier presencia > 0.01% activa la alerta
        const minThreshold = 0.01;

        // Prioridad 1: Si hay CUALQUIER presencia de rojo → Bandera ROJA
        if (detection.redPercentage > minThreshold) {
            this.logger.warn(`🔴 ALERTA ROJA: Detectado ${detection.redPercentage}% de rojo`);
            return {
                level: 'red',
                label: 'STRONG CURRENTS',
                description: 'Corrientes fuertes detectadas - Peligro alto'
            };
        }

        // Prioridad 2: Si hay CUALQUIER presencia de amarillo → Bandera AMARILLA
        if (detection.yellowPercentage > minThreshold) {
            this.logger.warn(`🟡 PRECAUCIÓN: Detectado ${detection.yellowPercentage}% de amarillo`);
            return {
                level: 'yellow',
                label: 'MODERATE CURRENTS',
                description: 'Corrientes moderadas detectadas - Precaución'
            };
        }

        // Sin colores de advertencia → Bandera BLANCA
        this.logger.info('✅ CONDICIONES CALMAS: No se detectaron colores de advertencia');
        return {
            level: 'white',
            label: 'CALM CONDITIONS',
            description: 'Condiciones calmadas - Seguro para nadar'
        };
    }

    /**
     * Actualiza el HTML para mostrar la bandera correcta
     */
    async updateHTML(detection: ColorDetectionResult): Promise<AlertStatus> {
        try {
            this.logger.info('Actualizando HTML con estado de alerta...');

            // 1. Determinar el nivel de alerta
            const alertStatus = this.determineAlertLevel(detection);

            // 2. Leer el HTML actual
            let html = await fs.readFile(this.templatePath, 'utf-8');

            // 3. Ocultar todas las banderas (agregar 'hidden' a todas)
            html = html.replace(
                /(<div class="flag-status-item status-overlay[^"]*" id="status-red">)/g,
                '<div class="flag-status-item status-overlay hidden" id="status-red">'
            );
            html = html.replace(
                /(<div class="flag-status-item status-overlay[^"]*" id="status-yellow">)/g,
                '<div class="flag-status-item status-overlay hidden" id="status-yellow">'
            );
            html = html.replace(
                /(<div class="flag-status-item status-overlay[^"]*" id="status-white">)/g,
                '<div class="flag-status-item status-overlay hidden" id="status-white">'
            );

            // 4. Mostrar solo la bandera correspondiente (quitar 'hidden')
            const statusId = `status-${alertStatus.level}`;
            html = html.replace(
                new RegExp(`(<div class="flag-status-item status-overlay) hidden(" id="${statusId}">)`),
                '$1$2'
            );

            // 5. Actualizar la fecha
            const today = new Date();
            const dateString = today.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            html = html.replace(
                /<span class="date-text">[^<]*<\/span>/,
                `<span class="date-text">${dateString}</span>`
            );

            // 6. Guardar el HTML actualizado
            await fs.writeFile(this.outputPath, html, 'utf-8');

            this.logger.info(`HTML actualizado: Bandera ${alertStatus.level.toUpperCase()} visible`);
            this.logger.info(`Estado: ${alertStatus.label}`);

            return alertStatus;
        } catch (error) {
            this.logger.error('Error al actualizar HTML:', error);
            throw error;
        }
    }


    /**
     * Exporta el HTML a una imagen PNG o JPG
     * Captura con viewport grande y redimensiona a 500x752
     */
    async exportToImage(
        outputImagePath?: string,
        finalWidth: number = 1500,
        finalHeight: number = 2257,
        format: 'png' | 'jpeg' = 'png'
    ): Promise<string> {
        let browser: Browser | null = null;
        let context: BrowserContext | null = null;
        
        try {
            this.logger.info(`Exportando HTML a imagen (final: ${finalWidth}x${finalHeight})...`);

            const defaultOutputPath = path.join(
                __dirname, 
                `../../public/final/output.${format === 'jpeg' ? 'jpg' : 'png'}`
            );
            const finalOutputPath = outputImagePath || defaultOutputPath;
            const tempPath = path.join(__dirname, '../../public/final/temp_capture.png');
            const htmlPath = `file://${this.outputPath}`;

            // Viewport ajustado al contenido del HTML (luego se hace upscaling con Sharp)
            // Ancho aumentado para incluir el overlay que se extiende a la derecha (mapa 600px + label 400px + margen 40px)
            const captureWidth = 1000;
            const captureHeight = 1500;

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
                browser = await PlaywrightConfig.launchWithTimeout(launchOptions);
                this.logger.info('Chromium iniciado correctamente');
            } catch (error) {
                this.logger.error('Error al iniciar Chromium:', error);
                throw new Error(`No se pudo iniciar Chromium: ${error instanceof Error ? error.message : 'Error desconocido'}`);
            }

            // Crear contexto con viewport configurado
            context = await PlaywrightConfig.createContext(browser, {
                width: captureWidth,
                height: captureHeight,
                deviceScaleFactor: 2  // Balance entre calidad y uso de memoria
            });

            let page: Page | null = await context.newPage();
            
            if (!page) {
                throw new Error('No se pudo crear la página en Chromium');
            }

            await page.goto(htmlPath, { 
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });

            await page.waitForSelector('.map-workflow', { timeout: 10000 });
            // Esperar un poco más para que la imagen de fondo del mapa se cargue completamente
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Capturar el elemento principal
            const element = page.locator('.bg-gradient-primary').first();
            
            try {
                // Intentar capturar el elemento específico
                const isVisible = await element.isVisible({ timeout: 1000 }).catch(() => false);
                if (isVisible) {
                    await element.screenshot({
                        path: tempPath,
                        type: 'png'
                    });
                } else {
                    throw new Error('Element not visible');
                }
            } catch (error) {
                // Si falla, capturar toda la página
            // Sin clip para que capture todo el contenido, incluso el que se extiende más allá del viewport
            const element = await page.$('.bg-gradient-primary');
            
            if (element) {
                // Esperar a que el contenido se renderice completamente
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Capturar sin clip para asegurar que incluya todo el contenido visible del elemento
                await element.screenshot({
                    path: tempPath,
                    type: 'png'
                });
            } else {
                await page.screenshot({
                    path: tempPath,
                    type: 'png',
                    fullPage: true
                });
            }
            }

            // CERRAR CHROME INMEDIATAMENTE después de captura (libera ~100-150 MB)
            await page.close();
            page = null;
            await context.close();
            context = null;
            await browser.close();
            browser = null;

            // Obtener dimensiones reales de la imagen capturada para mantener el aspect ratio
            const imageMetadata = await sharp(tempPath).metadata();
            const capturedWidth = imageMetadata.width || captureWidth;
            const capturedHeight = imageMetadata.height || captureHeight;
            const aspectRatio = capturedWidth / capturedHeight;

            // Priorizar mantener 1500px de ancho y calcular el alto proporcionalmente
            const targetWidth = finalWidth; // Siempre 1500px
            const targetHeight = Math.round(finalWidth / aspectRatio);

            this.logger.info(`Imagen capturada: ${capturedWidth}x${capturedHeight} (aspect ratio: ${aspectRatio.toFixed(3)})`);
            this.logger.info(`Redimensionando a: ${targetWidth}x${targetHeight} (ancho fijo: ${targetWidth}px)`);
            
            const sharpInstance = sharp(tempPath)
                // Upscaling con el mejor algoritmo (lanczos3 es ideal para ampliar)
                // Usar 'fill' para mantener exactamente 1500px de ancho
                .resize(targetWidth, targetHeight, {
                    fit: 'fill',
                    kernel: 'lanczos3',
                    withoutEnlargement: false
                })
                // Sharpening después del upscaling para recuperar nitidez
                .sharpen({
                    sigma: 1.2,        // Más sharpening para compensar upscaling
                    m1: 0.8,
                    m2: 2.0,
                    x1: 2.0,
                    y2: 10.0,
                    y3: 20.0
                });

            // Aplicar formato con configuración óptima
            if (format === 'png') {
                await sharpInstance
                    .png({ 
                        quality: 100,
                        compressionLevel: 6,  // Balance compresión/velocidad
                        adaptiveFiltering: true
                    })
                    .toFile(finalOutputPath);
            } else {
                await sharpInstance
                    .jpeg({ 
                        quality: 95,
                        chromaSubsampling: '4:4:4',  // Sin pérdida de color
                        mozjpeg: true  // Mejor compresión
                    })
                    .toFile(finalOutputPath);
            }

            // Eliminar archivo temporal inmediatamente (libera espacio en disco)
            await fs.unlink(tempPath).catch(() => {
                // Ignorar error si el archivo ya no existe
            });

            const stats = await fs.stat(finalOutputPath);
            
            this.logger.info(`✅ Imagen exportada: ${finalOutputPath}`);
            this.logger.info(`   Dimensiones: ${finalWidth}x${finalHeight}px`);
            this.logger.info(`   Tamaño: ${(stats.size / 1024).toFixed(1)} KB`);

            return finalOutputPath;
        } catch (error) {
            this.logger.error('Error al exportar imagen:', error);
            throw error;
        } finally {
            if (context) {
                await context.close().catch(() => {});
            }
            if (browser) {
                await browser.close().catch(() => {});
            }
        }
    }
}

