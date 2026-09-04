import type { AuthIdentityVerifier } from '../../application/auth/auth-identity-verifier.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';

export interface SupabaseTokenVerifier {
  verify(token: string): Promise<{ sub?: string } | null>;
}

/**
 * Infrastructure-only adapter. A concrete JWT verifier will be supplied once
 * the Supabase project and its Auth configuration exist.
 */
export class SupabaseAuthAdapter implements AuthIdentityVerifier {
  public constructor(private readonly tokenVerifier: SupabaseTokenVerifier) {}

  public async verify(accessToken: string): Promise<AuthenticatedIdentity | null> {
    const claims = await this.tokenVerifier.verify(accessToken);

    if (!claims?.sub) {
      return null;
    }

    return { subject: claims.sub };
  }
}
