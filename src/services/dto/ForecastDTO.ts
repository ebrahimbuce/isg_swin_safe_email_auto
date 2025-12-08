/**
 * Data Transfer Objects para el ForecastService
 */

import { ColorDetectionResult } from './ImageProcessorDTO.js';
import { AlertStatus } from '../HTMLGeneratorService.js';

export interface ForecastResult {
  imageProcessed: boolean;
  imagePath: string;
  colorDetection: ColorDetectionResult;
  alertStatus: AlertStatus;
  outputImagePath: string;
}

export interface ForecastConfig {
  url?: string;
  outputPath?: string;
  cropTop?: number;
  cropBottom?: number;
}
