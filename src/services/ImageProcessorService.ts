import sharp from 'sharp';
import { Logger } from './Logger.js';
import fs from 'fs';
import type {
  ImageProcessingOptions,
  ColorDetectionResult,
  ImageCompressionOptions,
  CachedImage,
  GetImageParams,
  SaveImageParams,
  CropImageParams,
  DetectColorsParams,
  CompressImageParams,
  GetImageBufferParams,
} from './dto/ImageProcessorDTO.js';

export type {
  ImageProcessingOptions,
  ColorDetectionResult,
  ImageCompressionOptions,
  CachedImage,
  GetImageParams,
  SaveImageParams,
  CropImageParams,
  DetectColorsParams,
  CompressImageParams,
  GetImageBufferParams,
};

export class ImageProcessorService {
  private imageCache: Map<string, CachedImage> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos

  constructor(private logger: Logger) {}

  async getImage(params: GetImageParams): Promise<Buffer> {
    const { url } = params;
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

  async saveImage(params: SaveImageParams): Promise<void> {
    const { image, path } = params;
    this.logger.debug(`Guardando imagen en: ${path}`);

    // Usar stream para evitar duplicar buffer en memoria
    const writeStream = fs.createWriteStream(path);

    await new Promise<void>((resolve, reject) => {
      writeStream.on('error', reject);
      writeStream.on('finish', resolve);

      sharp(image).pipe(writeStream).on('error', reject);
    });

    this.logger.info(`Imagen guardada: ${path}`);
  }

  async cropImage(params: CropImageParams): Promise<Buffer> {
    const { image, cropTop, cropBottom } = params;
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
          height: newHeight,
        })
        .toBuffer();
    } catch (error) {
      this.logger.error('Error al recortar imagen:', error);
      throw error;
    }
  }

  /**
   * Detecta la presencia de colores rojo y amarillo en la imagen
   * @param params - Parámetros de detección (imagen y umbral)
   */
  async detectColors(params: DetectColorsParams): Promise<ColorDetectionResult> {
    const { image, threshold = 0.5 } = params;
    try {
      this.logger.debug('Detectando colores rojo y amarillo en la imagen...'); // Obtener los datos raw de la imagen
      const { data, info } = await sharp(image).raw().toBuffer({ resolveWithObject: true });

      const totalPixels = info.width * info.height;
      let redCount = 0;
      let yellowCount = 0;

      // Recorrer cada píxel optimizado (cada píxel tiene 3 o 4 valores: R, G, B, y opcionalmente A)
      const channels = info.channels;
      const dataLength = data.length;

      // Optimización: procesar en un solo loop con condiciones optimizadas
      for (let i = 0; i < dataLength; i += channels) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Optimización: evaluar condiciones más probables primero
        if (r > 150) {
          // Detectar rojo: R alto, G y B bajos
          if (r > g * 1.5 && r > b * 1.5) {
            redCount++;
          }
          // Detectar amarillo: R y G altos, B bajo
          else if (g > 150 && b < 150) {
            const diff = r - g;
            if (diff >= -50 && diff <= 50) {
              // Optimización: evitar Math.abs
              yellowCount++;
            }
          }
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
        totalPixels,
      };
    } catch (error) {
      this.logger.error('Error al detectar colores:', error);
      throw error;
    }
  }

  /**
   * Comprime una imagen para optimizar el tamaño del email
   * @param params - Parámetros de compresión
   * @returns Buffer de la imagen comprimida
   */
  async compressImageForEmail(params: CompressImageParams): Promise<Buffer> {
    const { imageBuffer, options = {} } = params;
    const { maxWidth = 800, quality = 85 } = options;

    try {
      const metadata = await sharp(imageBuffer).metadata();
      const originalSize = imageBuffer.length;

      // Solo comprimir si la imagen es más grande que maxWidth
      if (metadata.width && metadata.width <= maxWidth) {
        this.logger.debug(`Imagen no necesita compresión (${metadata.width}px <= ${maxWidth}px)`);
        return imageBuffer;
      }

      const compressed = await sharp(imageBuffer)
        .resize(maxWidth, null, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .png({
          quality: quality,
          compressionLevel: 9,
        })
        .toBuffer();

      const compressedSize = compressed.length;
      const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(1);

      this.logger.debug(
        `Imagen comprimida: ${(originalSize / 1024).toFixed(2)} KB → ${(compressedSize / 1024).toFixed(
          2
        )} KB (${reduction}% reducción)`
      );

      // Asegurar que es un Buffer estándar de Node.js
      return Buffer.from(compressed);
    } catch (error) {
      this.logger.warn('Error al comprimir imagen, usando original:', error);
      return imageBuffer; // Devolver original si falla la compresión
    }
  }

  /**
   * Obtiene la imagen desde cache o del disco, con compresión opcional
   * @param params - Parámetros para obtener la imagen
   */
  async getImageBuffer(params: GetImageBufferParams): Promise<Buffer> {
    const { imagePath, compress = true, options = {} } = params;
    const now = Date.now();
    const cacheKey = `${imagePath}:${compress}`; // Verificar cache
    const cached = this.imageCache.get(cacheKey);
    if (cached && now - cached.timestamp < this.CACHE_TTL) {
      this.logger.debug(`Imagen cargada desde cache: ${imagePath}`);
      return cached.buffer;
    }

    // Verificar que la imagen existe
    try {
      await fs.promises.access(imagePath);
    } catch (error) {
      throw new Error(`Imagen no encontrada: ${imagePath}`);
    }

    // Leer imagen del disco
    let buffer: Buffer = await fs.promises.readFile(imagePath);
    const originalSize = buffer.length;

    // Comprimir si está habilitado
    if (compress) {
      buffer = Buffer.from(await this.compressImageForEmail({ imageBuffer: buffer, options }));
    } // Guardar en cache
    this.imageCache.set(cacheKey, { buffer, timestamp: now });
    this.logger.debug(
      `Imagen cargada y cacheada: ${imagePath} (${(buffer.length / 1024).toFixed(2)} KB${
        compress && buffer.length < originalSize ? ' comprimida' : ''
      })`
    );

    // Limpiar cache expirado periódicamente
    this.cleanExpiredCache();

    return buffer;
  }

  /**
   * Limpia entradas expiradas del cache
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [path, data] of this.imageCache.entries()) {
      if (now - data.timestamp >= this.CACHE_TTL) {
        this.imageCache.delete(path);
        this.logger.debug(`Cache expirado eliminado: ${path}`);
      }
    }
  }

  /**
   * Limpia el cache de imágenes
   */
  clearImageCache(): void {
    const size = this.imageCache.size;
    this.imageCache.clear();
    this.logger.info(`Cache de imágenes limpiado (${size} entradas eliminadas)`);
  }

  /**
   * Obtiene el tamaño del cache
   */
  getCacheSize(): number {
    return this.imageCache.size;
  }
}
