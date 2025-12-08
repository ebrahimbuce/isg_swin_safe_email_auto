/**
 * Data Transfer Objects para el HTMLEmailGeneratorService
 */

import { ForecastResult } from './ForecastDTO.js';

export type AlertLevel = 'red' | 'yellow' | 'white';

export interface AlertEmailConfig {
  level: AlertLevel;
  emoji: string;
  title: string;
  message: string;
}

export interface EmailTemplateData {
  alertLevel: AlertLevel;
  alertEmoji: string;
  alertTitle: string;
  alertMessage: string;
  date: string;
}

export interface GenerateEmailParams {
  forecastResult: ForecastResult;
}

export interface GenerateEmailHTMLParams {
  data: EmailTemplateData;
}

export interface GenerateEmailSubjectParams {
  data: EmailTemplateData;
}
