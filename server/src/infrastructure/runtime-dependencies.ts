import { GetOrProvisionCurrentPlayer } from '../application/player/get-or-provision-current-player.js';
import type { AppConfig } from '../config/environment.js';
import { createSupabaseAuthAdapter } from './auth/supabase-auth-adapter.js';
import { PrismaCurrentPlayerStore } from './database/prisma-current-player-store.js';
import { createDatabase } from './database/prisma-database.js';

export function createRuntimeDependencies(config: AppConfig) {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required to start database-backed routes.');
  }

  const issuer = resolveSupabaseIssuer(config);
  const database = createDatabase(config.databaseUrl);
  const store = new PrismaCurrentPlayerStore(database);

  return {
    authIdentityVerifier: createSupabaseAuthAdapter(issuer),
    getOrProvisionCurrentPlayer: new GetOrProvisionCurrentPlayer(store),
    close: () => database.$disconnect(),
  };
}

function resolveSupabaseIssuer(config: AppConfig): string {
  if (config.supabase.jwtIssuer) {
    return config.supabase.jwtIssuer;
  }

  if (config.supabase.url) {
    return new URL('/auth/v1', config.supabase.url).toString();
  }

  throw new Error('SUPABASE_JWT_ISSUER or SUPABASE_URL is required to verify access tokens.');
}
