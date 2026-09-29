import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export function parseTwitchCredentialKey(value: string): Buffer {
  const key = Buffer.from(value, 'base64');
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value) || key.length !== 32 || key.toString('base64') !== value)
    throw new Error('TWITCH_OAUTH_CREDENTIAL_KEY must be canonical base64 encoding exactly 32 bytes.');
  return key;
}

/** Server-only envelope; the identity and purpose are authenticated, never interchangeable. */
export class TwitchGiftCredentialCipher {
  private readonly key: Buffer;
  constructor(key: string) { this.key = parseTwitchCredentialKey(key); }
  private aad(playerId: string, twitchUserId: string) {
    return Buffer.from(JSON.stringify(['AUTHORIZE_GIFT_SUPREME', playerId, twitchUserId]));
  }
  encrypt(token: string, playerId: string, twitchUserId: string): string {
    if (!token || token.length > 8192) throw new Error('Invalid Gift credential.');
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(this.aad(playerId, twitchUserId));
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
  }
  decrypt(envelope: string, playerId: string, twitchUserId: string): string {
    try {
      if (!/^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{2,10923}$/.test(envelope)) throw new Error();
      const [, iv, tag, encrypted] = envelope.split('.');
      const decode = (value: string) => { const decoded = Buffer.from(value, 'base64url'); if (decoded.toString('base64url') !== value) throw new Error(); return decoded; };
      const decipher = createDecipheriv('aes-256-gcm', this.key, decode(iv!));
      decipher.setAAD(this.aad(playerId, twitchUserId)); decipher.setAuthTag(decode(tag!));
      const token = Buffer.concat([decipher.update(decode(encrypted!)), decipher.final()]).toString('utf8');
      if (!token || token.length > 8192) throw new Error();
      return token;
    } catch { throw new Error('Invalid Gift credential.'); }
  }
}
