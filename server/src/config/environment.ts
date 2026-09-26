import { z } from 'zod';

const optionalUrl = z.url().optional();

const environmentSchema = z.object({
  HOST: z.string().trim().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  FRONTEND_ORIGIN: z.url().default('http://localhost:5173'),
  DATABASE_URL: optionalUrl,
  SUPABASE_URL: optionalUrl,
  SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1).optional(),
  SUPABASE_JWT_ISSUER: optionalUrl,
  TWITCH_CLIENT_ID: z.string().trim().min(1).optional(),
  TWITCH_CLIENT_SECRET: z.string().trim().min(1).optional(),
  TWITCH_REDIRECT_URI: optionalUrl,
  TWITCH_PILOT_PLAYER_IDS: z.string().default(''),
  TWITCH_PILOT_LOGIN: z.string().trim().default('kichnifou'),
});

export type AppConfig = Readonly<{
  host: string;
  port: number;
  frontendOrigin?: string;
  databaseUrl?: string;
  supabase: Readonly<{
    url?: string;
    publishableKey?: string;
    jwtIssuer?: string;
  }>;
  twitch?: Readonly<{ clientId?: string; clientSecret?: string; redirectUri?: string; pilotPlayerIds: readonly string[]; pilotLogin: string }>;
}>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.safeParse(environment);

  if (!parsed.success) {
    throw new Error(`Invalid server environment: ${z.prettifyError(parsed.error)}`);
  }

  return {
    host: parsed.data.HOST,
    port: parsed.data.PORT,
    frontendOrigin: parsed.data.FRONTEND_ORIGIN,
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
  };
}
