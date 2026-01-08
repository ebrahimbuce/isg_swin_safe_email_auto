import { Logger } from './Logger.js';
import type { ColorDetectionResult } from './dto/ImageProcessorDTO.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Browser, Page, BrowserContext } from 'playwright';
import sharp from 'sharp';
import { PlaywrightConfig } from './PlaywrightConfig.js';
import type { AlertLevel, AlertStatus, UpdateHTMLParams, ExportToImageParams } from './dto/HTMLGeneratorDTO.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type { AlertLevel, AlertStatus };

export class HTMLGeneratorService {
  private templatePath: string;
  private outputPath: string;

  constructor(private logger: Logger) {
    this.templatePath = path.join(__dirname, '../../public/template.html');
    this.outputPath = path.join(__dirname, '../../public/index.html');
  }

  /**
   * Determina el nivel de alerta basado en la detección de colores
   * Prioridad: Rojo > Amarillo > Blanco
   * Cualquier presencia mínima de color activa la alerta
   */
  determineAlertLevel(detection: ColorDetectionResult): AlertStatus {
    // Umbral mínimo: se aumenta a 0.5% para evitar falsos positivos por ruido en la imagen
    const minThreshold = 0.5;

    // Prioridad 1: Si hay CUALQUIER presencia de rojo → Bandera ROJA
    if (detection.redPercentage > minThreshold) {
      this.logger.warn(`🔴 ALERTA ROJA: Detectado ${detection.redPercentage}% de rojo`);
      return {
        level: 'high',
        label: 'STRONG CURRENTS',
        label_en: 'Strong Currents',
        label_es: 'Corrientes Fuertes',
      };
    }

    // Prioridad 2: Si hay CUALQUIER presencia de amarillo → Bandera AMARILLA
    if (detection.yellowPercentage > minThreshold) {
      this.logger.warn(`🟡 PRECAUCIÓN: Detectado ${detection.yellowPercentage}% de amarillo`);
      return {
        level: 'moderate',
        label: 'MODERATE CURRENTS',
        label_en: 'Moderate Currents',
        label_es: 'Corrientes Moderadas',
      };
    }

    // Sin colores de advertencia → Bandera BLANCA
    this.logger.info('✅ CONDICIONES CALMAS: No se detectaron colores de advertencia');
    return {
      level: 'low',
      label: 'CALM CONDITIONS',
      label_en: 'Calm Conditions',
      label_es: 'Condiciones Calmas',
    };
  }

  /**
   * Actualiza el HTML para mostrar la bandera correcta
   */
  async updateHTML(params: UpdateHTMLParams): Promise<AlertStatus> {
    const { detection } = params;
    try {
      this.logger.info('Actualizando HTML con estado de alerta...');

      // 1. Determinar el nivel de alerta
      const alertStatus = this.determineAlertLevel(detection);

      // 2. Leer el HTML actual
      let html = await fs.readFile(this.templatePath, 'utf-8');

      // 3. Ocultar todas las banderas (agregar 'hidden' a todas)
      html = this.hideAllFlags(html);

      // 4. Mostrar solo la bandera correspondiente (quitar 'hidden')
      html = this.showFlag(html, alertStatus.level);

      // 5. Actualizar la fecha
      html = this.updateDate(html);

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
   * Oculta todas las banderas de alerta en el HTML
   */
  private hideAllFlags(html: string): string {
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
    return html;
  }

  /**
   * Muestra la bandera de alerta correspondiente
   */
  private showFlag(html: string, level: AlertLevel): string {
    // Mapear los niveles internos a los IDs del HTML
    const levelMap: Record<string, string> = {
      high: 'red',
      moderate: 'yellow',
      low: 'white',
      red: 'red',
      yellow: 'yellow',
      white: 'white',
    };
    const htmlLevel = levelMap[level] ?? 'white';
    const statusId = `status-${htmlLevel}`;
    return html.replace(
      new RegExp(`(<div class="flag-status-item status-overlay) hidden(" id="${statusId}">)`),
      '$1$2'
    );
  }

  /**
   * Actualiza la fecha en el HTML
   */
  private updateDate(html: string): string {
    const today = new Date();
    const dateString = today.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return html.replace(/<span class="date-text">[^<]*<\/span>/, `<span class="date-text">${dateString}</span>`);
  }

  /**
   * Exporta el HTML a una imagen PNG o JPG
   * Captura con viewport grande y redimensiona con Sharp
   */
  async exportToImage(params: ExportToImageParams): Promise<string> {
    const { htmlPath, width = 1500, height = 2257, format = 'png' } = params;

    let browser: Browser | null = null;
    let context: BrowserContext | null = null;

    try {
      this.logger.info(`Exportando HTML a imagen (final: ${width}x${height})...`);

      const outputImagePath =
        htmlPath || path.join(__dirname, `../../public/final/output.${format === 'jpeg' ? 'jpg' : 'png'}`);
      const tempPath = path.join(__dirname, '../../public/final/temp_capture.png');

      // Inicializar navegador
      const browserContext = await this.initializeBrowser();
      browser = browserContext.browser;
      context = browserContext.context;

      // Capturar screenshot
      await this.captureScreenshot(context, tempPath);

      // Cerrar navegador inmediatamente
      await this.closeBrowser(browser, context);
      browser = null;
      context = null;

      // Procesar y redimensionar imagen
      await this.processAndResizeImage(tempPath, outputImagePath, width, format);

      // Limpiar archivo temporal
      await this.cleanupTempFile(tempPath);

      // Log resultado
      await this.logExportResult(outputImagePath, width, height);

      return outputImagePath;
    } catch (error) {
      this.logger.error('Error al exportar imagen:', error);
      throw error;
    } finally {
      await this.closeBrowser(browser, context);
    }
  }

  /**
   * Inicializa el navegador con Playwright
   */
  private async initializeBrowser(): Promise<{ browser: Browser; context: BrowserContext }> {
    const captureWidth = 930;
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
    let browser: Browser;
    try {
      browser = await PlaywrightConfig.launchWithTimeout(launchOptions);
      this.logger.info('Chromium iniciado correctamente');
    } catch (error) {
      this.logger.error('Error al iniciar Chromium:', error);
      throw new Error(`No se pudo iniciar Chromium: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }

    // Crear contexto con viewport configurado
    const context = await PlaywrightConfig.createContext(browser, {
      width: captureWidth,
      height: captureHeight,
      deviceScaleFactor: 2, // Balance entre calidad y uso de memoria
    });

    return { browser, context };
  }

  /**
   * Captura el screenshot de la página HTML
   */
  private async captureScreenshot(context: BrowserContext, tempPath: string): Promise<void> {
    const htmlPath = `file://${this.outputPath}`;
    let page: Page | null = await context.newPage();

    if (!page) {
      throw new Error('No se pudo crear la página en Chromium');
    }

    await page.goto(htmlPath, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await page.waitForSelector('.map-workflow', { timeout: 10000 });
    // Esperar un poco más para que la imagen de fondo del mapa se cargue completamente
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Capturar el elemento principal
    await this.captureElement(page, tempPath);

    await page.close();
  }

  /**
   * Captura un elemento específico o toda la página
   */
  private async captureElement(page: Page, tempPath: string): Promise<void> {
    const element = page.locator('.bg-gradient-primary').first();

    try {
      // Intentar capturar el elemento específico
      const isVisible = await element.isVisible({ timeout: 1000 }).catch(() => false);
      if (isVisible) {
        await element.screenshot({
          path: tempPath,
          type: 'png',
        });
        return;
      }
      throw new Error('Element not visible');
    } catch (error) {
      // Si falla, capturar toda la página
      const elementHandle = await page.$('.bg-gradient-primary');

      if (elementHandle) {
        // Esperar a que el contenido se renderice completamente
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Capturar sin clip para asegurar que incluya todo el contenido visible del elemento
        await elementHandle.screenshot({
          path: tempPath,
          type: 'png',
        });
      } else {
        await page.screenshot({
          path: tempPath,
          type: 'png',
          fullPage: true,
        });
      }
    }
  }

  /**
   * Procesa y redimensiona la imagen capturada
   */
  private async processAndResizeImage(
    tempPath: string,
    outputPath: string,
    finalWidth: number,
    format: 'png' | 'jpeg'
  ): Promise<void> {
    // Obtener dimensiones reales de la imagen capturada para mantener el aspect ratio
    const imageMetadata = await sharp(tempPath).metadata();
    const capturedWidth = imageMetadata.width || 950;
    const capturedHeight = imageMetadata.height || 1500;
    const aspectRatio = capturedWidth / capturedHeight;

    // Priorizar mantener el ancho especificado y calcular el alto proporcionalmente
    const targetWidth = finalWidth;
    const targetHeight = Math.round(finalWidth / aspectRatio);

    this.logger.info(`Imagen capturada: ${capturedWidth}x${capturedHeight} (aspect ratio: ${aspectRatio.toFixed(3)})`);
    this.logger.info(`Redimensionando a: ${targetWidth}x${targetHeight} (ancho fijo: ${targetWidth}px)`);

    const sharpInstance = sharp(tempPath)
      .resize(targetWidth, targetHeight, {
        fit: 'fill',
        kernel: 'lanczos3',
        withoutEnlargement: false,
      })
      .sharpen({
        sigma: 1.2,
        m1: 0.8,
        m2: 2.0,
        x1: 2.0,
        y2: 10.0,
        y3: 20.0,
      });

    // Aplicar formato con configuración óptima
    if (format === 'png') {
      await sharpInstance
        .png({
          quality: 100,
          compressionLevel: 6,
          adaptiveFiltering: true,
        })
        .toFile(outputPath);
    } else {
      await sharpInstance
        .jpeg({
          quality: 95,
          chromaSubsampling: '4:4:4',
          mozjpeg: true,
        })
        .toFile(outputPath);
    }
  }

  /**
   * Cierra el navegador y el contexto
   */
  private async closeBrowser(browser: Browser | null, context: BrowserContext | null): Promise<void> {
    if (context) {
      await context.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
  }

  /**
   * Elimina el archivo temporal
   */
  private async cleanupTempFile(tempPath: string): Promise<void> {
    await fs.unlink(tempPath).catch(() => {
      // Ignorar error si el archivo ya no existe
    });
  }

  /**
   * Registra el resultado de la exportación
   */
  private async logExportResult(outputPath: string, width: number, height: number): Promise<void> {
    const stats = await fs.stat(outputPath);
    this.logger.info(`✅ Imagen exportada: ${outputPath}`);
    this.logger.info(`   Dimensiones: ${width}x${height}px`);
    this.logger.info(`   Tamaño: ${(stats.size / 1024).toFixed(1)} KB`);
  }
}
