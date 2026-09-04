import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JSONWebKeySet,
} from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  SupabaseAuthAdapter,
  SupabaseJwtVerifier,
} from '../src/infrastructure/auth/supabase-auth-adapter.js';

const issuer = 'https://project-id.supabase.co/auth/v1';
const subject = '00000000-0000-4000-8000-000000000001';

describe('Supabase JWT verification', () => {
  let privateKey: CryptoKey;
  let keySet: ReturnType<typeof createLocalJWKSet>;

  beforeAll(async () => {
    const keyPair = await generateKeyPair('RS256');
    privateKey = keyPair.privateKey;
    const publicKey = await exportJWK(keyPair.publicKey);
    publicKey.alg = 'RS256';
    publicKey.kid = 'test-key';
    keySet = createLocalJWKSet({ keys: [publicKey] } as JSONWebKeySet);
  });

  async function createToken(options?: Readonly<{ tokenIssuer?: string; expiresAt?: number }>) {
    return new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(options?.tokenIssuer ?? issuer)
      .setSubject(subject)
      .setIssuedAt()
      .setExpirationTime(options?.expiresAt ?? Math.floor(Date.now() / 1_000) + 300)
      .sign(privateKey);
  }

  it('returns only the authenticated subject for a valid signed token', async () => {
    const adapter = new SupabaseAuthAdapter(new SupabaseJwtVerifier(issuer, keySet));

    await expect(adapter.verify(await createToken())).resolves.toEqual({ subject });
  });

  it('rejects an expired token', async () => {
    const verifier = new SupabaseJwtVerifier(issuer, keySet);

    await expect(
      verifier.verify(await createToken({ expiresAt: Math.floor(Date.now() / 1_000) - 10 })),
    ).resolves.toBeNull();
  });

  it('rejects a token issued by another issuer', async () => {
    const verifier = new SupabaseJwtVerifier(issuer, keySet);

    await expect(
      verifier.verify(await createToken({ tokenIssuer: 'https://untrusted.example/auth/v1' })),
    ).resolves.toBeNull();
  });

  it('rejects a token signed by an unknown key', async () => {
    const untrustedKeyPair = await generateKeyPair('RS256');
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'unknown-key' })
      .setIssuer(issuer)
      .setSubject(subject)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(untrustedKeyPair.privateKey);
    const verifier = new SupabaseJwtVerifier(issuer, keySet);

    await expect(verifier.verify(token)).resolves.toBeNull();
  });
});
