/**
 * Data Transfer Objects para el EmailService
 */

import { ForecastResult } from './ForecastDTO.js';

export interface EmailConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  service?: string;
  auth: {
    user: string;
    pass: string;
  };
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  path?: string;
  content?: Buffer | string;
  contentType?: string;
  cid?: string;
}

export interface ForecastEmailData {
  html: string;
  subject: string;
  imagePath: string;
}

export interface EmailSendResult {
  success: number;
  failed: number;
  total: number;
}

export interface EmailMetrics {
  emailsSent: number;
  emailsFailed: number;
  totalSendTime: number;
  averageSendTime: number;
  cacheSize: number;
}

export interface SendParams {
  options: EmailOptions;
  maxRetries?: number;
}

export interface SendWithImageParams {
  to: string | string[];
  subject: string;
  htmlContent: string;
  imagePath: string;
  imageFilename?: string;
}

export interface SendWithEmbeddedImageParams {
  to: string | string[];
  subject: string;
  htmlContent: string;
  imagePath: string;
  maxRetries?: number;
  compress?: boolean;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  htmlContent: string;
  imageBuffer: Buffer;
  maxRetries?: number;
}

export interface SendForecastReportParams {
  to: string | string[];
  forecastResult?: ForecastResult;
  useParallel?: boolean;
}

export interface SendForecastParallelParams {
  to: string | string[];
  forecastResult?: ForecastResult;
  batchSize?: number;
}
