import sharp from 'sharp';
import { Logger } from './Logger.js';

export interface ImageProcessingOptions {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp';
}

export interface ColorDetectionResult {
    hasRed: boolean;
    hasYellow: boolean;
    redPercentage: number;
    yellowPercentage: number;
    totalPixels: number;
}

export class ImageProcessorService {
    constructor(private logger: Logger) {}

    async getImage(url: string): Promise<Buffer> {
        this.logger.debug(`Descargando imagen de: ${url}`);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Error al descargar imagen: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }

    async processImage(image: Buffer): Promise<Buffer> {
        return await sharp(image).toBuffer();
    }

    async saveImage(image: Buffer, path: string): Promise<void> {
        this.logger.debug(`Guardando imagen en: ${path}`);
        await sharp(image).toFile(path);
        this.logger.info(`Imagen guardada: ${path}`);
    }

    async cropImage(image: Buffer, cropTop: number, cropBottom: number): Promise<Buffer> {
        try {
            const metadata = await sharp(image).metadata();
            const { width, height } = metadata;

            if (!width || !height) {
                throw new Error('No se pudo obtener las dimensiones de la imagen');
            }

            // Calcular la altura final después del recorte
            const newHeight = height - cropTop - cropBottom;

            this.logger.debug(`Recortando imagen: top=${cropTop}px, bottom=${cropBottom}px`);
            this.logger.debug(`Dimensiones originales: ${width}x${height}`);
            this.logger.debug(`Dimensiones finales: ${width}x${newHeight}`);

            return await sharp(image)
                .extract({
                    left: 0,
                    top: cropTop,
                    width: width,
                    height: newHeight
                })
                .toBuffer();
        } catch (error) {
            this.logger.error('Error al recortar imagen:', error);
            throw error;
        }
    }

    /**
     * Detecta la presencia de colores rojo y amarillo en la imagen
     * @param image Buffer de la imagen a analizar
     * @param threshold Umbral de porcentaje para considerar que el color está presente (por defecto 0.5%)
     */
    async detectColors(image: Buffer, threshold: number = 0.5): Promise<ColorDetectionResult> {
        try {
            this.logger.debug('Detectando colores rojo y amarillo en la imagen...');

            // Obtener los datos raw de la imagen
            const { data, info } = await sharp(image)
                .raw()
                .toBuffer({ resolveWithObject: true });

            const totalPixels = info.width * info.height;
            let redCount = 0;
            let yellowCount = 0;

            // Recorrer cada píxel (cada píxel tiene 3 o 4 valores: R, G, B, y opcionalmente A)
            const channels = info.channels;
            
            for (let i = 0; i < data.length; i += channels) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                // Detectar rojo: R alto, G y B bajos
                // Rojo: R > 150, R > G*2, R > B*2
                if (r > 150 && r > g * 1.5 && r > b * 1.5) {
                    redCount++;
                }

                // Detectar amarillo: R y G altos, B bajo
                // Amarillo: R > 150, G > 150, B < 150, |R-G| < 50
                if (r > 150 && g > 150 && b < 150 && Math.abs(r - g) < 50) {
                    yellowCount++;
                }
            }

            const redPercentage = (redCount / totalPixels) * 100;
            const yellowPercentage = (yellowCount / totalPixels) * 100;

            const hasRed = redPercentage >= threshold;
            const hasYellow = yellowPercentage >= threshold;

            this.logger.debug(`Píxeles rojos: ${redCount} (${redPercentage.toFixed(2)}%)`);
            this.logger.debug(`Píxeles amarillos: ${yellowCount} (${yellowPercentage.toFixed(2)}%)`);
            this.logger.info(`Detección - Rojo: ${hasRed}, Amarillo: ${hasYellow}`);

            return {
                hasRed,
                hasYellow,
                redPercentage: parseFloat(redPercentage.toFixed(2)),
                yellowPercentage: parseFloat(yellowPercentage.toFixed(2)),
                totalPixels
            };
        } catch (error) {
            this.logger.error('Error al detectar colores:', error);
            throw error;
        }
    }

}

