/**
 * Data Transfer Objects para el HTMLGeneratorService
 */

import { ColorDetectionResult } from './ImageProcessorDTO.js';

export type AlertLevel = 'moderate' | 'low' | 'high';

export interface AlertStatus {
  level: AlertLevel;
  label: string;
  label_en: string; // Etiqueta en Inglés
  label_es: string; // Etiqueta en Español
}

export interface UpdateHTMLParams {
  detection: ColorDetectionResult;
}

export interface ExportToImageParams {
  htmlPath?: string;
  width?: number;
  height?: number;
  format?: 'png' | 'jpeg';
}

export interface GenerateFinalImageParams {
  htmlPath?: string;
}
