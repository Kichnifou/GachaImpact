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
  };
}
