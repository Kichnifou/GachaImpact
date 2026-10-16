import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { decodeJwt } from 'jose';
import type { AuthIdentityVerifier } from '../../application/auth/auth-identity-verifier.js';
import { AppError } from '../../api/errors.js';

export interface AccountAuthAdmin {
  verifyFresh(token: string, subject: string): Promise<void>;
  isLive(token: string, subject: string): Promise<boolean>;
  deleteUser(subject: string): Promise<void>;
  removeStorage(bucket: string, names: string[]): Promise<void>;
}

/** Dedicated server-only client; no session persistence, browser storage or password transport. */
export class SupabaseAccountAdmin implements AccountAuthAdmin {
  private readonly client: SupabaseClient;
  constructor(url: string, secret: string, private readonly verifier: AuthIdentityVerifier) {
    this.client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { 'User-Agent': 'GachaImpact-Account-Admin/1.0' }, fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) }) } });
  }
  async isLive(token: string, subject: string) {
    const { data, error } = await this.client.auth.getUser(token);
    if (error && ![401, 403, 404].includes(error.status ?? 0)) throw new AppError('Vérification du compte indisponible.', 503, 'ACCOUNT_AUTH_UNAVAILABLE');
    return !error && data.user?.id === subject;
  }
  async verifyFresh(token: string, subject: string) {
    const identity = await this.verifier.verify(token);
    if (!identity || identity.subject !== subject) throw new AppError('Vérifie à nouveau ton identité.', 401, 'ACCOUNT_REAUTH_REQUIRED');
    // decode only AFTER cryptographic issuer/signature/expiry verification. iat/refresh are not reauthentication.
    const claims = decodeJwt(token), now = Math.floor(Date.now() / 1000);
    const methods = claims.amr as { method?: string; timestamp?: number }[] | undefined;
    if (!Array.isArray(methods) || !methods.some(method => method.method === 'password' && typeof method.timestamp === 'number'
      && method.timestamp <= now + 5 && method.timestamp >= now - 300) || !await this.isLive(token, subject))
      throw new AppError('Vérifie à nouveau ton identité avec ton mot de passe.', 401, 'ACCOUNT_REAUTH_REQUIRED');
  }
  async deleteUser(subject: string) {
    const { error } = await this.client.auth.admin.deleteUser(subject, false);
    if (error && error.code !== 'user_not_found') throw new AppError('La suppression est en cours. Réessaie dans quelques instants.', 503, 'ACCOUNT_DELETION_PENDING');
    const check = await this.client.auth.admin.getUserById(subject);
    if (check.error?.code !== 'user_not_found') throw new AppError('La clôture du compte reste à vérifier.', 503, 'ACCOUNT_DELETION_PENDING');
  }
  async removeStorage(bucket: string, names: string[]) {
    if (!names.length) return;
    const { error } = await this.client.storage.from(bucket).remove(names);
    if (error) throw new AppError('La suppression des fichiers personnels reste en cours.', 503, 'ACCOUNT_DELETION_PENDING');
  }
}
