import type { Prisma } from '../../../generated/prisma/client.js';

// A tagged tree avoids Date.toJSON and retains bigint/undefined without lossy coercion.
export function freezeCommandValue(value: unknown): Prisma.JsonValue {
  if (value === undefined) return { type: 'undefined' };
  if (typeof value === 'bigint') return { type: 'bigint', value: String(value) };
  if (value instanceof Date) return { type: 'date', value: value.toISOString() };
  if (Array.isArray(value)) return { type: 'array', value: value.map(freezeCommandValue) };
  if (value && typeof value === 'object') return { type: 'object', value: Object.fromEntries(Object.entries(value).map(([key, child]) => [key, freezeCommandValue(child)])) };
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  throw new Error('TWITCH_COMMAND_INTENT_INVALID_VALUE');
}
export function thawCommandValue(value: Prisma.JsonValue): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  switch (value.type) {
    case 'undefined': return undefined;
    case 'bigint': return BigInt(value.value as string);
    case 'date': return new Date(value.value as string);
    case 'array': return (value.value as Prisma.JsonArray).map(thawCommandValue);
    case 'object': return Object.fromEntries(Object.entries(value.value as Prisma.JsonObject).map(([key, child]) => [key, thawCommandValue(child!)]));
    default: throw new Error('TWITCH_COMMAND_INTENT_INVALID_VALUE');
  }
}
