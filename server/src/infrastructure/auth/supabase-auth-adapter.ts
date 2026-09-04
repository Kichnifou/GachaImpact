import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

import type { AuthIdentityVerifier } from '../../application/auth/auth-identity-verifier.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';

export interface SupabaseTokenVerifier {
  verify(token: string): Promise<{ sub?: string } | null>;
}

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

export class SupabaseJwtVerifier implements SupabaseTokenVerifier {
  private readonly issuer: string;
  private readonly keySet: JWTVerifyGetKey;

  public constructor(issuer: string, keySet?: JWTVerifyGetKey) {
    this.issuer = normalizeIssuer(issuer);
    this.keySet =
      keySet ??
      createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`), {
        cacheMaxAge: 10 * 60 * 1_000,
        cooldownDuration: 30_000,
        timeoutDuration: 5_000,
      });
  }

  public async verify(token: string): Promise<{ sub: string } | null> {
    try {
      const { payload } = await jwtVerify(token, this.keySet, {
        issuer: this.issuer,
        requiredClaims: ['iss', 'sub', 'exp'],
      });

      if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
        return null;
      }

      return { sub: payload.sub };
    } catch {
      return null;
    }
  }
}

export function createSupabaseAuthAdapter(issuer: string): SupabaseAuthAdapter {
  return new SupabaseAuthAdapter(new SupabaseJwtVerifier(issuer));
}

function normalizeIssuer(issuer: string): string {
  const issuerUrl = new URL(issuer);
  issuerUrl.hash = '';
  issuerUrl.search = '';
  issuerUrl.pathname = issuerUrl.pathname.replace(/\/+$/, '');

  return issuerUrl.toString().replace(/\/$/, '');
}
