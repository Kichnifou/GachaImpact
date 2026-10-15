import type { Prisma } from '../../../generated/prisma/client.js';
import { encodeIntentReads, decodeIntentReads } from '../twitch/twitch-intent-storage.js';

/** No field removal. Integrity-checked reversible storage for durable JSON details. */
export function compactDetail(value:Prisma.JsonValue):Prisma.JsonValue {
  if(value&&typeof value==='object'&&!Array.isArray(value)&&Object.hasOwn(value,'retentionEncoding')) {
    expandDetail(value);return value;
  }
  const encoded=encodeIntentReads({payload:[value]});
  if(!('encoding' in encoded)) return value;
  const result={retentionEncoding:'lossless-brotli-v1',envelope:encoded};
  return Buffer.byteLength(JSON.stringify(result))<Buffer.byteLength(JSON.stringify(value))?result:value;
}
export function expandDetail(value:Prisma.JsonValue|null):Prisma.JsonValue|null {
  if(!value||typeof value!=='object'||Array.isArray(value)||!Object.hasOwn(value,'retentionEncoding')) return value;
  if(value.retentionEncoding!=='lossless-brotli-v1') throw new Error('RETENTION_DETAIL_VERSION_UNKNOWN');
  const decoded=decodeIntentReads(value.envelope);
  if(!decoded||typeof decoded!=='object'||Array.isArray(decoded)||!('payload' in decoded)||!Array.isArray(decoded.payload)||decoded.payload.length!==1) throw new Error('RETENTION_DETAIL_INVALID');
  return decoded.payload[0] as Prisma.JsonValue;
}
