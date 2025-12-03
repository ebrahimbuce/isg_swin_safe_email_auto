import { Logger } from "./Logger.js";
import { ColorDetectionResult } from "./ImageProcessorService.js";
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import puppeteer from 'puppeteer';
import sharp from 'sharp';

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
     * Genera un resumen del estado actual
     */
    generateSummary(detection: ColorDetectionResult, alertStatus: AlertStatus): string {
        const lines = [
            '╔══════════════════════════════════════════════════════════════╗',
            '║               RESUMEN DE ESTADO DE PLAYA                     ║',
            '╚══════════════════════════════════════════════════════════════╝',
            '',
            `📊 Detección de Colores:`,
            `   🔴 Rojo: ${detection.redPercentage}%`,
            `   🟡 Amarillo: ${detection.yellowPercentage}%`,
            '',
            `🚩 Bandera Seleccionada: ${alertStatus.level.toUpperCase()}`,
            `📋 Estado: ${alertStatus.label}`,
            `📝 Descripción: ${alertStatus.description}`,
            '',
            '══════════════════════════════════════════════════════════════'
        ];

        return lines.join('\n');
    }

    /**
     * Exporta el HTML a una imagen PNG o JPG
     * Captura con viewport grande y redimensiona a 500x752
     */
    async exportToImage(
        outputImagePath?: string,
        finalWidth: number = 500,
        finalHeight: number = 752,
        format: 'png' | 'jpeg' = 'png'
    ): Promise<string> {
        let browser = null;
        
        try {
            this.logger.info(`Exportando HTML a imagen (final: ${finalWidth}x${finalHeight})...`);

            const defaultOutputPath = path.join(
                __dirname, 
                `../../public/final/output.${format === 'jpeg' ? 'jpg' : 'png'}`
            );
            const finalOutputPath = outputImagePath || defaultOutputPath;
            const tempPath = path.join(__dirname, '../../public/final/temp_capture.png');
            const htmlPath = `file://${this.outputPath}`;

            // Viewport moderado para balance calidad/memoria (1000x1504 con deviceScaleFactor 2 = 2000x3008 efectivos)
            const captureWidth = 1000;
            const captureHeight = 1504;  // 1000 * 1.504

            // Configuración de Puppeteer optimizada para servidores con poca RAM
            const launchOptions: any = {
                headless: 'new',
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
                    // Optimizaciones de memoria
                    '--js-flags=--max-old-space-size=256',
                    '--disable-accelerated-2d-canvas',
                    '--disable-canvas-aa',
                    '--disable-2d-canvas-clip-aa',
                    '--disable-gl-drawing-for-tests'
                ]
            };

            // Buscar Chrome en rutas conocidas
            const chromePaths = [
                process.env.PUPPETEER_EXECUTABLE_PATH,
                '/usr/bin/google-chrome-stable',
                '/usr/bin/google-chrome',
                '/usr/bin/chromium-browser',
                '/usr/bin/chromium'
            ].filter(Boolean);

            for (const chromePath of chromePaths) {
                try {
                    const fs = await import('fs');
                    if (fs.existsSync(chromePath as string)) {
                        launchOptions.executablePath = chromePath;
                        this.logger.info(`Usando Chrome: ${chromePath}`);
                        break;
                    }
                } catch {}
            }

            browser = await puppeteer.launch(launchOptions);

            const page = await browser.newPage();

            await page.setViewport({
                width: captureWidth,
                height: captureHeight,
                deviceScaleFactor: 2  // Balance entre calidad y uso de memoria
            });

            await page.goto(htmlPath, { 
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            await page.waitForSelector('.map-workflow', { timeout: 5000 });
            await new Promise(resolve => setTimeout(resolve, 500));

            // Capturar el elemento principal
            const element = await page.$('.bg-gradient-primary');
            
            if (element) {
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

            await browser.close();
            browser = null;

            // Redimensionar a las dimensiones finales con procesamiento de alta calidad
            this.logger.info(`Redimensionando a ${finalWidth}x${finalHeight} con optimización de calidad...`);
            
            const sharpInstance = sharp(tempPath)
                .resize(finalWidth, finalHeight, {
                    fit: 'fill',
                    kernel: 'lanczos3',  // Mejor algoritmo de interpolación
                    withoutEnlargement: false
                })
                // Mejora de nitidez adaptativa
                .sharpen({
                    sigma: 0.8,      // Un poco más de sharpening
                    m1: 1.0,         // Flat areas
                    m2: 2.0,         // Jagged areas  
                    x1: 2.0,         // Threshold
                    y2: 10.0,        // Maximum brightening
                    y3: 20.0         // Maximum darkening
                })
                // Mejorar contraste ligeramente
                .modulate({
                    brightness: 1.02,  // Ligeramente más brillante
                    saturation: 1.05   // Colores un poco más vivos
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

            // Eliminar archivo temporal
            await fs.unlink(tempPath);

            const stats = await fs.stat(finalOutputPath);
            
            this.logger.info(`✅ Imagen exportada: ${finalOutputPath}`);
            this.logger.info(`   Dimensiones: ${finalWidth}x${finalHeight}px`);
            this.logger.info(`   Tamaño: ${(stats.size / 1024).toFixed(1)} KB`);

            return finalOutputPath;
        } catch (error) {
            this.logger.error('Error al exportar imagen:', error);
            throw error;
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }
}

