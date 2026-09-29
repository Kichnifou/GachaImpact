import { describe, expect, it } from 'vitest';
import { parseTwitchCredentialKey, TwitchGiftCredentialCipher } from '../src/infrastructure/twitch/twitch-gift-credential-cipher.js';
import { giftKey } from './helpers/twitch-gift-fixture.js';
describe('Gift AES-256-GCM credential', () => {
  it('accepts exactly 32 canonical base64 bytes', () => expect(parseTwitchCredentialKey(giftKey)).toHaveLength(32));
  it.each(['', 'private-key', Buffer.alloc(31).toString('base64'), Buffer.alloc(33).toString('base64'), `${giftKey}\n`, giftKey.slice(0, -1)])('rejects invalid key without echoing it (%#)', key => {
    expect(() => parseTwitchCredentialKey(key)).toThrow();
    try { parseTwitchCredentialKey(key); } catch (error) { if (key) expect(String(error)).not.toContain(key); }
  });
  it('roundtrips with random IV and never reveals plaintext', () => {
    const cipher = new TwitchGiftCredentialCipher(giftKey), a = cipher.encrypt('private-refresh', 'player', '123'), b = cipher.encrypt('private-refresh', 'player', '123');
    expect(a).not.toBe(b); expect(a).not.toContain('private-refresh'); expect(cipher.decrypt(a, 'player', '123')).toBe('private-refresh');
  });
  it.each(['ciphertext', 'tag', 'iv', 'player', 'twitch', 'version'])('authenticates %s', kind => {
    const cipher = new TwitchGiftCredentialCipher(giftKey), parts = cipher.encrypt('private-refresh', 'player', '123').split('.');
    const index = kind === 'ciphertext' ? 3 : kind === 'tag' ? 2 : kind === 'iv' ? 1 : 0;
    if (!['player', 'twitch'].includes(kind)) parts[index] = (parts[index]![0] === 'A' ? 'B' : 'A') + parts[index]!.slice(1);
    try { cipher.decrypt(parts.join('.'), kind === 'player' ? 'other' : 'player', kind === 'twitch' ? '999' : '123'); throw Error('accepted'); }
    catch (error) { expect(String(error)).toContain('Invalid Gift credential'); expect(String(error)).not.toMatch(/private-refresh|v1\.|BwcHB/); }
  });
});
