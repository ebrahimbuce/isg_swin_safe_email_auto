/**
 * Data Transfer Objects para el HTMLGeneratorService
 */

import { ColorDetectionResult } from './ImageProcessorDTO.js';

export type AlertLevel = 'red' | 'yellow' | 'white';

export interface AlertStatus {
  level: AlertLevel;
  label: string;
  description: string;
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
