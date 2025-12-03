import { Logger } from "./Logger.js";
import { ImageProcessorService, ColorDetectionResult } from "./ImageProcessorService.js";
import { HTMLGeneratorService, AlertStatus } from "./HTMLGeneratorService.js";
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ForecastResult {
    imageProcessed: boolean;
    imagePath: string;
    colorDetection: ColorDetectionResult;
    alertStatus: AlertStatus;
    outputImagePath: string;
}

export class ForecastService {
    private url: string = 'https://www.weather.gov/images/sju/ghwo/RipRiskDay1.jpg';
    private outputPath: string;
    private htmlGenerator: HTMLGeneratorService;
    
    // Configuración de recorte (en píxeles)
    private cropTop: number = 80;      // Píxeles a recortar de la parte superior
    private cropBottom: number = 50;   // Píxeles a recortar de la parte inferior

    constructor(
        private logger: Logger,
        private imageProcessor: ImageProcessorService
    ) {
        // Ruta relativa desde dist/services hasta public/images
        this.outputPath = path.join(__dirname, '../../public/images/forecast.jpg');
        this.htmlGenerator = new HTMLGeneratorService(logger);
    }

    /**
     * Obtiene el pronóstico de riesgo de corrientes marinas
     * Descarga, procesa y guarda la imagen del forecast
     * Detecta la presencia de colores rojo y amarillo
     * Actualiza el HTML con la bandera correspondiente
     */
    async getForecast(): Promise<ForecastResult> {
        try {
            this.logger.info('Iniciando obtención de forecast...');
            
            // 1. Obtener la imagen de la URL
            const image = await this.getImage();
            
            // 2. Procesar la imagen (recortar partes superior e inferior)
            const processedImage = await this.processImage(image);
            
            // 3. Detectar colores en la imagen procesada (usando umbral mínimo)
            const colorDetection = await this.detectColorsMinimal(processedImage);
            
            // 4. Guardar la imagen procesada
            await this.saveImage(processedImage);
            
            // 5. Actualizar el HTML con la bandera correcta
            const alertStatus = await this.htmlGenerator.updateHTML(colorDetection);
            
            // 6. Exportar HTML a imagen HD (1500x2257px)
            const outputImagePath = await this.htmlGenerator.exportToImage(
                undefined,
                1500,      // Ancho final HD
                2257,      // Alto final HD
                'png'
            );
            
            this.logger.info('Forecast obtenido y procesado exitosamente');
            this.logColorDetectionSummary(colorDetection);
            
            // 7. Mostrar resumen
            const summary = this.htmlGenerator.generateSummary(colorDetection, alertStatus);
            console.log(summary);
            
            return {
                imageProcessed: true,
                imagePath: this.outputPath,
                colorDetection,
                alertStatus,
                outputImagePath
            };
        } catch (error) {
            this.logger.error('Error al obtener forecast:', error);
            throw error;
        }
    }

    /**
     * Descarga la imagen desde la URL
     */
    private async getImage(): Promise<Buffer> {
        return await this.imageProcessor.getImage(this.url);
    }

    /**
     * Procesa la imagen recortando las partes superior e inferior
     */
    private async processImage(image: Buffer): Promise<Buffer> {
        return await this.imageProcessor.cropImage(image, this.cropTop, this.cropBottom);
    }

    /**
     * Guarda la imagen procesada en public/images
     */
    private async saveImage(image: Buffer): Promise<void> {
        await this.imageProcessor.saveImage(image, this.outputPath);
    }


    /**
     * Detecta colores con umbral mínimo (cualquier presencia activa la alerta)
     */
    private async detectColorsMinimal(image: Buffer): Promise<ColorDetectionResult> {
        // Usar umbral muy bajo (0.01%) para detectar cualquier presencia mínima
        return await this.imageProcessor.detectColors(image, 0.01);
    }

    /**
     * Muestra un resumen legible de la detección de colores
     */
    private logColorDetectionSummary(detection: ColorDetectionResult): void {
        this.logger.info('=== RESUMEN DE DETECCIÓN DE COLORES ===');
        
        if (detection.hasRed && detection.hasYellow) {
            this.logger.warn('⚠️  ALERTA: Se detectaron ROJO y AMARILLO');
        } else if (detection.hasRed) {
            this.logger.warn('🔴 ALERTA: Se detectó color ROJO');
        } else if (detection.hasYellow) {
            this.logger.warn('🟡 PRECAUCIÓN: Se detectó color AMARILLO');
        } else {
            this.logger.info('✅ No se detectaron colores de advertencia significativos');
        }
        
        this.logger.info(`   Rojo: ${detection.redPercentage}% de la imagen`);
        this.logger.info(`   Amarillo: ${detection.yellowPercentage}% de la imagen`);
        this.logger.info('========================================');
    }

    /**
     * Configura los píxeles a recortar
     */
    setCropValues(top: number, bottom: number): void {
        this.cropTop = top;
        this.cropBottom = bottom;
        this.logger.debug(`Valores de recorte actualizados: top=${top}, bottom=${bottom}`);
    }

    /**
     * Configura la URL de la imagen
     */
    setUrl(url: string): void {
        this.url = url;
        this.logger.debug(`URL actualizada: ${url}`);
    }

    /**
     * Configura la ruta de salida
     */
    setOutputPath(outputPath: string): void {
        this.outputPath = outputPath;
        this.logger.debug(`Ruta de salida actualizada: ${outputPath}`);
    }
}