import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { freezeCommandValue, thawCommandValue } from '../src/application/twitch/twitch-command-intent.js';
import { decodeIntentReads, encodeIntentReads } from '../src/application/twitch/twitch-intent-storage.js';

describe('lossless frozen reads', () => {
  const reads = { 'getCurrentPlayerBox.execute': [freezeCommandValue({ characters: Array.from({ length: 150 }, (_, i) => ({ id: `character-${i}`, name: 'Étoile 🌟', copies: BigInt(i), at: new Date('2026-10-15T00:00:00Z'), missing: undefined })) })] };
  it('roundtrips the frozen tagged representation and reconstructs dates, bigint, Unicode and undefined', () => {
    const encoded = encodeIntentReads(reads);
    expect(encoded).toMatchObject({ encoding: 'brotli-base64', version: 1 });
    expect(decodeIntentReads(encoded)).toEqual(reads);
    expect(thawCommandValue((decodeIntentReads(encoded) as typeof reads)['getCurrentPlayerBox.execute'][0]!)).toEqual(thawCommandValue(reads['getCurrentPlayerBox.execute'][0]!));
    expect(Buffer.byteLength(JSON.stringify(encoded))).toBeLessThan(Buffer.byteLength(JSON.stringify(reads)) * 0.2);
  });
  it('keeps old and short reads unchanged', () => {
    const short = { 'socialService.actor': [{ name: 'A' }] };
    expect(encodeIntentReads(short)).toBe(short); expect(decodeIntentReads(short)).toBe(short);
    expect(decodeIntentReads(reads)).toBe(reads);
  });
  it('keeps a high-entropy read when the gain does not justify an envelope', () => {
    const noisy = { 'getCurrentPlayerBox.execute': [randomBytes(6000).toString('base64')] };
    expect(encodeIntentReads(noisy)).toBe(noisy);
  });
  it.each(['version', 'bytes', 'sha256', 'data', 'encoding'])('rejects corrupted %s without a fallback', field => {
    const encoded = { ...encodeIntentReads(reads), [field]: field === 'bytes' ? 1 : field === 'version' ? 99 : 'corrupt' };
    expect(() => decodeIntentReads(encoded)).toThrow('TWITCH_INTENT_STORAGE_INVALID');
  });
  it('bounds decompression and checks declared length', () => {
    const encoded = encodeIntentReads(reads) as { bytes: number };
    expect(() => decodeIntentReads({ ...encoded, bytes: 16 * 1024 * 1024 + 1 })).toThrow();
    expect(() => decodeIntentReads({ ...encoded, bytes: encoded.bytes + 1 })).toThrow();
  });
  it('decodes a valid multi-megabyte base64 payload without regex stack limits', () => {
    const value = { 'getCurrentPlayerBox.execute': Array.from({ length: 65000 }, () => ({ id: randomBytes(24).toString('hex'), element: 'hydro', active: true })) };
    const encoded = encodeIntentReads(value);
    expect(encoded).toHaveProperty('encoding');
    expect(JSON.stringify(encoded).length).toBeGreaterThan(1_000_000);
    expect(decodeIntentReads(encoded)).toEqual(value);
  });
});
