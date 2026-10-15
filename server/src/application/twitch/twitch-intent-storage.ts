import { createHash } from 'node:crypto';
import { brotliCompressSync, brotliDecompressSync, constants } from 'node:zlib';
import type { Prisma } from '../../../generated/prisma/client.js';

type Reads = Record<string, Prisma.JsonValue[]>;
type CompressedReads = { encoding: 'brotli-base64'; version: 1; bytes: number; sha256: string; data: string };
const maximumBytes = 16 * 1024 * 1024;
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

/** Lossless storage only. The command's execution envelope stays queryable. */
export function encodeIntentReads(reads: Reads): Reads | CompressedReads {
  const bytes = Buffer.from(JSON.stringify(reads));
  if (bytes.length < 2048 || bytes.length > maximumBytes) return reads;
  const compressed: CompressedReads = { encoding: 'brotli-base64', version: 1, bytes: bytes.length,
    sha256: digest(bytes), data: brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } }).toString('base64') };
  const size = Buffer.byteLength(JSON.stringify(compressed));
  return size <= bytes.length * 0.8 && bytes.length - size >= 256 ? compressed : reads;
}

/** Corrupt/unknown encodings fail closed; never fall back to live service reads. */
export function decodeIntentReads(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.hasOwn(value, 'encoding')) return value;
  const row = value as Record<string, unknown>;
  if (row.encoding !== 'brotli-base64' || row.version !== 1 || typeof row.bytes !== 'number'
    || !Number.isSafeInteger(row.bytes) || row.bytes <= 0 || row.bytes > maximumBytes
    || typeof row.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(row.sha256)
    || typeof row.data !== 'string' || row.data.length > maximumBytes * 2) {
    throw new Error('TWITCH_INTENT_STORAGE_INVALID');
  }
  try {
    const compressed = Buffer.from(row.data, 'base64');
    // Canonical roundtrip avoids a repeated-group RegExp stack limit on large,
    // otherwise valid payloads and rejects permissive Buffer base64 parsing.
    if (compressed.toString('base64') !== row.data) throw new Error('base64');
    const bytes = brotliDecompressSync(compressed, { maxOutputLength: row.bytes });
    if (bytes.length !== row.bytes || digest(bytes) !== row.sha256) throw new Error('integrity');
    return JSON.parse(bytes.toString('utf8')) as unknown;
  } catch { throw new Error('TWITCH_INTENT_STORAGE_INVALID'); }
}
