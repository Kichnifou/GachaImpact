import { createHmac } from 'node:crypto';

export type EventDrawParticipant = Readonly<{ playerId: string; points: string }>;

/** A persisted private 256-bit seed makes rollback/restart deterministic. Rejection
 * sampling avoids modulo bias; every ticket is represented as an exact bigint. */
export function eventDrawPosition(seed: string, total: bigint): bigint {
  if (!/^[a-f0-9]{64}$/u.test(seed) || total <= 0n) throw new Error('EVENT_DRAW_INVALID_RANDOM_INPUT');
  const bits = (total - 1n).toString(2).length;
  const bytes = Math.ceil(bits / 8), mask = (1n << BigInt(bits)) - 1n;
  for (let attempt = 0; ; attempt++) {
    const blocks: Buffer[] = [];
    for (let block = 0; block * 32 < bytes; block++) blocks.push(createHmac('sha256', Buffer.from(seed, 'hex')).update(`event-monthly-draw:v1:${attempt}:${block}`).digest());
    const position = BigInt('0x' + Buffer.concat(blocks).subarray(0, bytes).toString('hex')) & mask;
    if (position < total) return position;
  }
}

export function eventDrawTotal(population: readonly EventDrawParticipant[]): bigint {
  let total = 0n;
  const ids = new Set<string>();
  for (const entry of population) {
    if (ids.has(entry.playerId) || !/^[1-9]\d*$/u.test(entry.points)) throw new Error('EVENT_DRAW_INVALID_POPULATION');
    ids.add(entry.playerId); total += BigInt(entry.points);
  }
  return total;
}

/** Stable player UUID order determines contiguous intervals, never their weight. */
export function eventDrawWinner(population: readonly EventDrawParticipant[], position: bigint): string {
  if (position < 0n || position >= eventDrawTotal(population)) throw new Error('EVENT_DRAW_INVALID_POSITION');
  let end = 0n;
  for (const entry of population) { end += BigInt(entry.points); if (position < end) return entry.playerId; }
  throw new Error('EVENT_DRAW_WINNER_MISSING');
}
