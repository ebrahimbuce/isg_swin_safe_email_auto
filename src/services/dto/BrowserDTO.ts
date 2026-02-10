/**
 * Data Transfer Objects para el BrowserService
 */

export interface NavigateToParams {
  url: string;
}

export interface CaptureScreenshotParams {
  path: string;
  fullPage?: boolean;
}

export interface ViewportSize {
  width: number;
  height: number;
}
