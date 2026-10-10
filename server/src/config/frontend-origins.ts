import type { AppConfig } from './environment.js';
import { AppError } from '../api/errors.js';

export const localFrontendOrigin = 'http://localhost:5173';

export function validateFrontendOrigin(value: string, production: boolean): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Invalid FRONTEND_ORIGIN / FRONTEND_ORIGINS: expected an exact origin.'); }
  if (value.length > 512 || value !== url.origin || url.hostname.includes('*') ||
      !(url.protocol === 'https:' || !production && value === localFrontendOrigin) ||
      production && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    throw new Error('Invalid FRONTEND_ORIGIN / FRONTEND_ORIGINS: expected an exact HTTPS origin (localhost:5173 in development only).');
  return value;
}

export function frontendOrigins(config: AppConfig): readonly string[] {
  return [...new Set([config.frontendOrigin ?? localFrontendOrigin, ...(config.frontendOrigins ?? [])])];
}

export function frontendReturnOrigin(config: AppConfig, requestOrigin?: string): string {
  const canonical = config.frontendOrigin ?? localFrontendOrigin;
  if (requestOrigin === undefined) return canonical;
  if (!frontendOrigins(config).includes(requestOrigin)) throw new AppError('Origine du site non autorisée.', 403, 'TWITCH_ORIGIN_INVALID');
  return requestOrigin;
}
