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

            // Viewport proporcional a 500x752 (ratio 1:1.504) pero más grande
            const captureWidth = 900;
            const captureHeight = 1354;  // 900 * 1.504

            // Configuración de Puppeteer compatible con Docker/Render/Railway
            const launchOptions: any = {
                headless: 'new', // Nuevo modo headless de Puppeteer
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-software-rasterizer',
                    '--disable-extensions',
                    '--disable-background-networking',
                    '--disable-sync',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process'
                ]
            };

            // Usar Chrome del contenedor si está disponible
            if (process.env.PUPPETEER_EXECUTABLE_PATH) {
                launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
                this.logger.debug(`Usando Chrome: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
            }

            browser = await puppeteer.launch(launchOptions);

            const page = await browser.newPage();

            await page.setViewport({
                width: captureWidth,
                height: captureHeight,
                deviceScaleFactor: 2  // Alta resolución para mejor calidad al redimensionar
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

            // Redimensionar a las dimensiones finales (500x752)
            this.logger.info(`Redimensionando a ${finalWidth}x${finalHeight}...`);
            
            await sharp(tempPath)
                .resize(finalWidth, finalHeight, {
                    fit: 'fill'  // Estirar para llenar exactamente las dimensiones
                })
                .toFormat(format, { quality: 95 })
                .toFile(finalOutputPath);

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

