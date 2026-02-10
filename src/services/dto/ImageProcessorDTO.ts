/**
 * Data Transfer Objects para el ImageProcessorService
 */

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

export interface ImageCompressionOptions {
  maxWidth?: number;
  quality?: number;
}

export interface CachedImage {
  buffer: Buffer;
  timestamp: number;
}

export interface GetImageParams {
  url: string;
}

export interface SaveImageParams {
  image: Buffer;
  path: string;
}

export interface CropImageParams {
  image: Buffer;
  cropTop: number;
  cropBottom: number;
}

export interface DetectColorsParams {
  image: Buffer;
  threshold?: number;
}

export interface CompressImageParams {
  imageBuffer: Buffer;
  options?: ImageCompressionOptions;
}

export interface GetImageBufferParams {
  imagePath: string;
  compress?: boolean;
  options?: ImageCompressionOptions;
}
