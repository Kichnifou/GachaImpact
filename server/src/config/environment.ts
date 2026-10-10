import { z } from 'zod';
import { parseTwitchCredentialKey } from '../infrastructure/twitch/twitch-gift-credential-cipher.js';
import { validateFrontendOrigin } from './frontend-origins.js';

const optionalUrl = z.url().optional();

const environmentSchema = z.object({
  HOST: z.string().trim().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  FRONTEND_ORIGIN: z.url().default('http://localhost:5173'),
  FRONTEND_ORIGINS: z.string().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: optionalUrl,
  SUPABASE_URL: optionalUrl,
  SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1).optional(),
  SUPABASE_JWT_ISSUER: optionalUrl,
  TWITCH_CLIENT_ID: z.string().trim().min(1).optional(),
  TWITCH_CLIENT_SECRET: z.string().trim().min(1).optional(),
  TWITCH_REDIRECT_URI: optionalUrl,
  TWITCH_PILOT_PLAYER_IDS: z.string().default(''),
  TWITCH_PILOT_LOGIN: z.string().trim().default('kichnifou'),
  TWITCH_EVENTSUB_WEBHOOK_ENABLED: z.enum(['true', 'false']).default('false'),
  TWITCH_COMMAND_PILOT_ENABLED: z.enum(['true', 'false']).default('false'),
  TWITCH_NATIVE_GLOBAL_ENABLED: z.enum(['true', 'false']).default('false'),
  TWITCH_EVENTSUB_SECRET: z.string().optional(),
  TWITCH_EVENTSUB_CALLBACK_URL: optionalUrl,
  TWITCH_GIFT_SUPREME_ENABLED: z.enum(['true', 'false']).default('false'),
  TWITCH_OAUTH_CREDENTIAL_KEY: z.string().optional(),
});

export type AppConfig = Readonly<{
  host: string;
  port: number;
  frontendOrigin?: string;
  frontendOrigins?: readonly string[];
  databaseUrl?: string;
  supabase: Readonly<{
    url?: string;
    publishableKey?: string;
    jwtIssuer?: string;
  }>;
  twitch?: Readonly<{ clientId?: string; clientSecret?: string; redirectUri?: string; pilotPlayerIds: readonly string[]; pilotLogin: string }>;
  twitchEventSub?: Readonly<{ enabled: boolean; secret?: string; callbackUrl?: string }>;
  twitchCommandPilot?: Readonly<{ enabled: boolean; globalEnabled?: boolean }>;
  twitchGiftSupreme?: Readonly<{ enabled: boolean; credentialKey?: string }>;
}>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.safeParse(environment);

  if (!parsed.success) {
    throw new Error(`Invalid server environment: ${z.prettifyError(parsed.error)}`);
  }
  const production = parsed.data.NODE_ENV === 'production';
  const frontendOrigin = validateFrontendOrigin(parsed.data.FRONTEND_ORIGIN, production);
  const additionalOrigins = parsed.data.FRONTEND_ORIGINS === undefined ? [] : parsed.data.FRONTEND_ORIGINS.split(',').map(value => value.trim());
  const frontendOrigins = [...new Set([frontendOrigin, ...additionalOrigins.map(value => validateFrontendOrigin(value, production))])];
  const eventSubEnabled = parsed.data.TWITCH_EVENTSUB_WEBHOOK_ENABLED === 'true';
  const eventSubSecret = parsed.data.TWITCH_EVENTSUB_SECRET;
  const callbackUrl = parsed.data.TWITCH_EVENTSUB_CALLBACK_URL;
  if (parsed.data.TWITCH_OAUTH_CREDENTIAL_KEY !== undefined) parseTwitchCredentialKey(parsed.data.TWITCH_OAUTH_CREDENTIAL_KEY);
  if (callbackUrl) {
    const url = new URL(callbackUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.port && url.port !== '443' || url.pathname !== '/api/v1/twitch/eventsub')
      throw new Error('TWITCH_EVENTSUB_CALLBACK_URL must be an HTTPS webhook URL without credentials, query or fragment.');
  }
  if (eventSubEnabled && (!eventSubSecret || eventSubSecret.length < 10 || eventSubSecret.length > 100 || !/^[\x20-\x7e]+$/.test(eventSubSecret))) {
    throw new Error('TWITCH_EVENTSUB_SECRET must be 10–100 ASCII characters when the webhook is enabled.');
  }

  return {
    host: parsed.data.HOST,
    port: parsed.data.PORT,
    frontendOrigin,
    frontendOrigins,
    databaseUrl: parsed.data.DATABASE_URL,
    supabase: {
      url: parsed.data.SUPABASE_URL,
      publishableKey: parsed.data.SUPABASE_PUBLISHABLE_KEY,
      jwtIssuer: parsed.data.SUPABASE_JWT_ISSUER,
    },
    twitch: {
      clientId: parsed.data.TWITCH_CLIENT_ID,
      clientSecret: parsed.data.TWITCH_CLIENT_SECRET,
      redirectUri: parsed.data.TWITCH_REDIRECT_URI,
      pilotPlayerIds: parsed.data.TWITCH_PILOT_PLAYER_IDS.split(',').map(value => value.trim()).filter(Boolean),
      pilotLogin: parsed.data.TWITCH_PILOT_LOGIN.toLowerCase(),
    },
    twitchEventSub: { enabled: eventSubEnabled, secret: eventSubSecret, callbackUrl },
    twitchCommandPilot: { enabled: parsed.data.TWITCH_COMMAND_PILOT_ENABLED === 'true', globalEnabled: parsed.data.TWITCH_NATIVE_GLOBAL_ENABLED === 'true' },
    twitchGiftSupreme: { enabled: parsed.data.TWITCH_GIFT_SUPREME_ENABLED === 'true', credentialKey: parsed.data.TWITCH_OAUTH_CREDENTIAL_KEY },
  };
}
